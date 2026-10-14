-- Personal to-dos that aren't assignments. Each account sees and edits only its own.
create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 300),
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists todos_profile_id_idx on public.todos (profile_id, created_at);

alter table public.todos enable row level security;

create policy "own todos" on public.todos
  for all to authenticated
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

-- This project doesn't grant new tables to API roles automatically.
grant select, insert, update, delete on public.todos to authenticated;
