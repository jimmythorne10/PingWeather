-- Add is_default and timezone columns to locations table
alter table public.locations
  add column if not exists is_default boolean not null default false;

alter table public.locations
  add column if not exists timezone text;

-- Ensure only one default location per user (partial unique index)
create unique index if not exists idx_locations_one_default_per_user
  on public.locations (user_id)
  where is_default = true;
