-- Study rooms used to trust the browser: passwords were readable by everyone and checked
-- client-side, and members, polls, and reactions were writable by anyone (even signed out).
-- Now the database decides. Reads are limited to room members; anything that changes a room
-- or a membership goes through the functions below, which check the caller's role.

-- ── Helpers ─────────────────────────────────────────────────────────
-- Your role in a room, or null if you're not a member or are kicked right now.
-- SECURITY DEFINER so policies on room_members can use it without recursing.
create or replace function public.room_role(p_room uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.room_members
  where room_id = p_room
    and profile_id = auth.uid()
    and (kicked_until is null or kicked_until <= now())
$$;

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

-- For storage paths like "<room id>/file.jpg": false instead of an error when it isn't a uuid.
create or replace function public.is_room_member_text(p_room text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return public.room_role(p_room::uuid) is not null;
exception when invalid_text_representation then
  return false;
end;
$$;

-- ── Rooms ───────────────────────────────────────────────────────────
-- Passwords are stored as bcrypt hashes and never leave the database.
alter table public.chat_rooms add column password_hash text;
update public.chat_rooms
  set password_hash = extensions.crypt(password, extensions.gen_salt('bf'))
  where coalesce(password, '') <> '';
alter table public.chat_rooms drop column password;
alter table public.chat_rooms add column has_password boolean generated always as (password_hash is not null) stored;

alter table public.chat_rooms
  add constraint chat_rooms_name_check check (char_length(btrim(name)) between 1 and 80) not valid,
  add constraint chat_rooms_description_check check (description is null or char_length(description) <= 500) not valid;

drop policy if exists "rooms authenticated insert" on public.chat_rooms;
revoke all on public.chat_rooms from authenticated;
grant select (id, name, description, created_by, created_at, pinned_message_id, pinned_content, has_password)
  on public.chat_rooms to authenticated;

create or replace function public.create_room(p_name text, p_description text default null, p_password text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then raise exception 'Sign in first.' using errcode = '28000'; end if;
  p_name := btrim(coalesce(p_name, ''));
  if char_length(p_name) not between 1 and 80 then
    raise exception 'Room names are 1 to 80 characters.' using errcode = '22023';
  end if;

  insert into public.chat_rooms (name, description, created_by, password_hash)
  values (
    p_name,
    left(nullif(btrim(coalesce(p_description, '')), ''), 500),
    v_uid,
    case when coalesce(p_password, '') <> '' then extensions.crypt(p_password, extensions.gen_salt('bf')) end
  )
  returning id into v_id;

  insert into public.room_members (room_id, profile_id, role) values (v_id, v_uid, 'owner');
  return v_id;
end;
$$;

-- Joins a room (or confirms you're already in it). Returns {status, role, kicked_until}:
-- status is 'joined', 'kicked', 'password_required', or 'wrong_password'.
create or replace function public.join_room(p_room uuid, p_password text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_hash text;
  v_member public.room_members%rowtype;
  v_role text;
begin
  if v_uid is null then raise exception 'Sign in first.' using errcode = '28000'; end if;

  select password_hash into v_hash from public.chat_rooms where id = p_room;
  if not found then raise exception 'Room not found.' using errcode = 'P0002'; end if;

  select * into v_member from public.room_members where room_id = p_room and profile_id = v_uid;
  if found then
    if v_member.kicked_until is not null and v_member.kicked_until > now() then
      return jsonb_build_object('status', 'kicked', 'kicked_until', v_member.kicked_until);
    end if;
    return jsonb_build_object('status', 'joined', 'role', v_member.role);
  end if;

  if v_hash is not null and not public.is_app_admin() then
    if coalesce(p_password, '') = '' then
      return jsonb_build_object('status', 'password_required');
    end if;
    if extensions.crypt(p_password, v_hash) <> v_hash then
      return jsonb_build_object('status', 'wrong_password');
    end if;
  end if;

  v_role := case when exists (select 1 from public.room_members where room_id = p_room and role = 'owner')
    then 'member' else 'owner' end;
  insert into public.room_members (room_id, profile_id, role) values (p_room, v_uid, v_role);
  return jsonb_build_object('status', 'joined', 'role', v_role);
end;
$$;

create or replace function public.delete_room(p_room uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.room_role(p_room) is distinct from 'owner' and not public.is_app_admin() then
    raise exception 'Only the owner can delete this room.' using errcode = '42501';
  end if;
  delete from public.chat_rooms where id = p_room;
end;
$$;

-- Pins a message, or unpins with p_message = null. Owners and moderators only.
create or replace function public.set_pinned_message(p_room uuid, p_message uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_preview text;
begin
  if coalesce(public.room_role(p_room), '') not in ('owner', 'moderator') and not public.is_app_admin() then
    raise exception 'Only owners and moderators can pin messages.' using errcode = '42501';
  end if;

  if p_message is null then
    update public.chat_rooms set pinned_message_id = null, pinned_content = null where id = p_room;
    return;
  end if;

  select case
      when poll_id is not null then '[Poll]'
      else coalesce(nullif(left(content, 100), ''), file_name, 'Attachment')
    end
    into v_preview
    from public.chat_messages
    where id = p_message and room_id = p_room and deleted_at is null;
  if not found then raise exception 'Message not found.' using errcode = 'P0002'; end if;

  update public.chat_rooms set pinned_message_id = p_message, pinned_content = v_preview where id = p_room;
end;
$$;

-- ── Members ─────────────────────────────────────────────────────────
drop policy if exists "room_members all" on public.room_members;
revoke all on public.room_members from authenticated;
grant select, delete on public.room_members to authenticated;

create policy "members see their room" on public.room_members for select to authenticated
  using (public.room_role(room_id) is not null or public.is_app_admin());
create policy "leave a room" on public.room_members for delete to authenticated
  using (profile_id = auth.uid() and role <> 'owner');

-- Owners make members moderators (or back), or hand over ownership with p_role = 'owner'.
create or replace function public.set_member_role(p_member uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.room_members%rowtype;
begin
  if p_role not in ('member', 'moderator', 'owner') then
    raise exception 'Unknown role.' using errcode = '22023';
  end if;
  select * into v_target from public.room_members where id = p_member;
  if not found then raise exception 'Member not found.' using errcode = 'P0002'; end if;
  if public.room_role(v_target.room_id) is distinct from 'owner' and not public.is_app_admin() then
    raise exception 'Only the owner can change roles.' using errcode = '42501';
  end if;
  if v_target.role = 'owner' then
    raise exception 'The owner''s role changes only by handing ownership to someone else.' using errcode = '42501';
  end if;

  if p_role = 'owner' then
    update public.room_members set role = 'moderator' where room_id = v_target.room_id and role = 'owner';
  end if;
  update public.room_members set role = p_role where id = p_member;
end;
$$;

-- Keeps someone out for 1 to 1440 minutes. Moderators can kick members; owners can kick anyone but themselves.
create or replace function public.kick_member(p_member uuid, p_minutes integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.room_members%rowtype;
  v_my_role text;
begin
  select * into v_target from public.room_members where id = p_member;
  if not found then raise exception 'Member not found.' using errcode = 'P0002'; end if;
  v_my_role := public.room_role(v_target.room_id);
  if public.is_app_admin() then v_my_role := 'owner'; end if;

  if v_target.profile_id = auth.uid() then raise exception 'You can''t kick yourself.' using errcode = '42501'; end if;
  if v_target.role = 'owner'
     or v_my_role is null
     or v_my_role = 'member'
     or (v_my_role = 'moderator' and v_target.role <> 'member') then
    raise exception 'You can''t kick this member.' using errcode = '42501';
  end if;

  update public.room_members
    set kicked_until = now() + make_interval(mins => least(greatest(coalesce(p_minutes, 10), 1), 1440))
    where id = p_member;
end;
$$;

-- ── Messages ────────────────────────────────────────────────────────
drop policy if exists "messages signed-in read" on public.chat_messages;
drop policy if exists "messages authenticated insert" on public.chat_messages;
revoke all on public.chat_messages from authenticated;
grant select, insert on public.chat_messages to authenticated;

alter table public.chat_messages
  add constraint chat_messages_content_check check (char_length(content) <= 4000) not valid;

create policy "members read messages" on public.chat_messages for select to authenticated
  using (public.room_role(room_id) is not null or public.is_app_admin());
create policy "members send messages" on public.chat_messages for insert to authenticated
  with check (
    profile_id = auth.uid()
    and deleted_at is null
    and public.room_role(room_id) is not null
    and (poll_id is null or exists (
      select 1 from public.room_polls p where p.id = poll_id and p.room_id = chat_messages.room_id
    ))
  );

-- "Delete for everyone": the author, or an owner or moderator. The text and file are cleared.
create or replace function public.delete_message(p_message uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_msg public.chat_messages%rowtype;
begin
  select * into v_msg from public.chat_messages where id = p_message;
  if not found then raise exception 'Message not found.' using errcode = 'P0002'; end if;
  if v_msg.profile_id is distinct from auth.uid()
     and public.room_role(v_msg.room_id) is distinct from 'owner'
     and public.room_role(v_msg.room_id) is distinct from 'moderator'
     and not public.is_app_admin() then
    raise exception 'You can''t delete this message.' using errcode = '42501';
  end if;

  update public.chat_messages
    set deleted_at = now(), content = '', file_url = null, file_name = null, file_type = null
    where id = p_message;
  update public.chat_rooms
    set pinned_message_id = null, pinned_content = null
    where id = v_msg.room_id and pinned_message_id = p_message;
end;
$$;

-- ── Reactions ───────────────────────────────────────────────────────
drop policy if exists "reactions all" on public.message_reactions;
revoke all on public.message_reactions from authenticated;
grant select, insert, delete on public.message_reactions to authenticated;

create policy "members read reactions" on public.message_reactions for select to authenticated
  using (exists (
    select 1 from public.chat_messages m
    where m.id = message_id and (public.room_role(m.room_id) is not null or public.is_app_admin())
  ));
create policy "react as yourself" on public.message_reactions for insert to authenticated
  with check (
    profile_id = auth.uid()
    and exists (select 1 from public.chat_messages m where m.id = message_id and public.room_role(m.room_id) is not null)
  );
create policy "remove your reaction" on public.message_reactions for delete to authenticated
  using (profile_id = auth.uid());

-- ── Polls ───────────────────────────────────────────────────────────
drop policy if exists "polls all" on public.room_polls;
revoke all on public.room_polls from authenticated;
grant select, insert on public.room_polls to authenticated;

create policy "members read polls" on public.room_polls for select to authenticated
  using (public.room_role(room_id) is not null or public.is_app_admin());
create policy "members create polls" on public.room_polls for insert to authenticated
  with check (
    profile_id = auth.uid()
    and public.room_role(room_id) is not null
    and char_length(btrim(question)) between 1 and 200
    and jsonb_typeof(options) = 'array'
    and jsonb_array_length(options) between 2 and 4
  );

-- The room page has always voted into poll_votes, but the table was never created.
create table public.poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.room_polls(id) on delete cascade,
  profile_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  option_index integer not null check (option_index between 0 and 3),
  created_at timestamptz not null default now(),
  unique (poll_id, profile_id)
);
alter table public.poll_votes enable row level security;
grant select, insert, delete on public.poll_votes to authenticated;

create policy "members read votes" on public.poll_votes for select to authenticated
  using (exists (
    select 1 from public.room_polls p
    where p.id = poll_id and (public.room_role(p.room_id) is not null or public.is_app_admin())
  ));
create policy "vote as yourself" on public.poll_votes for insert to authenticated
  with check (
    profile_id = auth.uid()
    and exists (
      select 1 from public.room_polls p
      where p.id = poll_id
        and public.room_role(p.room_id) is not null
        and option_index < jsonb_array_length(p.options)
    )
  );
create policy "take back your vote" on public.poll_votes for delete to authenticated
  using (profile_id = auth.uid());

-- Live updates for reactions and votes, like messages already have.
alter publication supabase_realtime add table public.message_reactions, public.poll_votes;

-- ── Chat files ──────────────────────────────────────────────────────
-- Uploaded to "<room id>/<file>"; only members of that room can upload there.
create policy "members upload chat files" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-files' and public.is_room_member_text((storage.foldername(name))[1]));

-- ── Who can call what ───────────────────────────────────────────────
revoke execute on function
  public.room_role(uuid), public.is_app_admin(), public.is_room_member_text(text),
  public.create_room(text, text, text), public.join_room(uuid, text), public.delete_room(uuid),
  public.set_pinned_message(uuid, uuid), public.set_member_role(uuid, text),
  public.kick_member(uuid, integer), public.delete_message(uuid)
  from public, anon;
grant execute on function
  public.room_role(uuid), public.is_app_admin(), public.is_room_member_text(text),
  public.create_room(text, text, text), public.join_room(uuid, text), public.delete_room(uuid),
  public.set_pinned_message(uuid, uuid), public.set_member_role(uuid, text),
  public.kick_member(uuid, integer), public.delete_message(uuid)
  to authenticated;
