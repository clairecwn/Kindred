-- Kindred saved state.
--
-- The client stores its world as independent JSON blobs addressed by a string
-- key ("kindred.journal", "kindred.coins", ...) via hooks/useDatabaseState.js.
-- This table mirrors that shape exactly, one row per (user, key), so the hook's
-- interface did not have to change when it gained a cloud backend.

create table if not exists public.user_state (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  key        text        not null,
  value      jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- Without RLS the anon key would let anyone read every row in this table, and
-- journal entries are the most private thing in the app. Each policy below
-- restricts a verb to rows owned by the caller.
alter table public.user_state enable row level security;

create policy "Read own state"
  on public.user_state for select
  using (auth.uid() = user_id);

create policy "Insert own state"
  on public.user_state for insert
  with check (auth.uid() = user_id);

create policy "Update own state"
  on public.user_state for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Delete own state"
  on public.user_state for delete
  using (auth.uid() = user_id);

-- Stamped server-side so a client cannot backdate a write.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_state_touch_updated_at
  before update on public.user_state
  for each row
  execute function public.touch_updated_at();
