-- One encrypted backup per account.
-- The server stores ciphertext only; the key never leaves the user's devices.

create table public.vaults (
  user_id uuid primary key references auth.users (id) on delete cascade,
  ciphertext text not null check (char_length(ciphertext) < 20000000),
  revision integer not null check (revision > 0),
  updated_at timestamptz not null default now()
);

alter table public.vaults enable row level security;

-- Each person can read and write their own row, and nothing else.
create policy "read own vault" on public.vaults
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "create own vault" on public.vaults
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "update own vault" on public.vaults
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
