-- Tighten who can touch what. Every page requires sign-in, so the anon role gets nothing
-- except one read on subjects for the keep-alive workflow (row-level security returns no rows).
revoke all on all tables in schema public from anon;
grant select on public.subjects to anon;

-- Not reachable through the API, but there's no reason to hold them.
revoke truncate, trigger, references on all tables in schema public from authenticated;

-- Profiles: you can read your own and change your name and photo. is_admin and plan are not
-- yours to edit, and rows are created by the sign-up trigger, never by the browser.
revoke insert, update, delete on public.profiles from authenticated;
grant update (name, avatar_url) on public.profiles to authenticated;

-- The sign-up trigger runs as its owner; nobody should call it (or the RLS event trigger) directly.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- Values the app understands. NOT VALID skips checking old rows; new and edited rows must pass.
alter table public.assignments
  add constraint assignments_status_check check (status in ('todo', 'in_progress', 'done')) not valid,
  add constraint assignments_priority_check check (priority between 1 and 3) not valid,
  add constraint assignments_title_check check (char_length(btrim(title)) between 1 and 300) not valid;
alter table public.notes
  add constraint notes_title_check check (char_length(btrim(title)) between 1 and 300) not valid;
alter table public.subjects
  add constraint subjects_name_check check (char_length(btrim(name)) between 1 and 80) not valid;

-- Storage: photos and chat files are viewed through public URLs, but only the owner can write.
drop policy if exists "avatars public" on storage.objects;
drop policy if exists "chat files public" on storage.objects;

create policy "own avatar read" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and name like 'avatars/' || auth.uid()::text || '.%');
create policy "own avatar insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and name like 'avatars/' || auth.uid()::text || '.%');
create policy "own avatar update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and name like 'avatars/' || auth.uid()::text || '.%')
  with check (bucket_id = 'avatars' and name like 'avatars/' || auth.uid()::text || '.%');
create policy "own avatar delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and name like 'avatars/' || auth.uid()::text || '.%');

update storage.buckets
  set file_size_limit = 5 * 1024 * 1024,
      allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
  where id = 'avatars';
update storage.buckets
  set file_size_limit = 10 * 1024 * 1024,
      allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf']
  where id = 'chat-files';
