-- Each signed-in user gets a daily number of AI requests, so one account can't run up the
-- Anthropic bill. The API routes claim one through claim_ai_request() before calling Claude.
create table public.ai_usage (
  profile_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  requests integer not null default 0,
  primary key (profile_id, day)
);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;

-- Counts one request for the caller today; true while they're within the limit. The limit
-- lives here, not in an argument, so calling the function directly can't raise it.
create or replace function public.claim_ai_request() returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  if auth.uid() is null then return false; end if;
  insert into public.ai_usage as u (profile_id, day, requests) values (auth.uid(), current_date, 1)
    on conflict (profile_id, day) do update set requests = u.requests + 1
    returning requests into v_count;
  return v_count <= 100;
end;
$$;

revoke execute on function public.claim_ai_request() from public, anon;
grant execute on function public.claim_ai_request() to authenticated;
