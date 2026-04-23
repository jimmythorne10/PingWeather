-- Add forecast digest preferences to profiles
alter table public.profiles
  add column if not exists digest_enabled boolean not null default false,
  add column if not exists digest_frequency text not null default 'daily'
    check (digest_frequency in ('daily', 'weekly')),
  add column if not exists digest_hour integer not null default 7
    check (digest_hour >= 0 and digest_hour <= 23),
  add column if not exists digest_day_of_week integer not null default 1
    check (digest_day_of_week >= 1 and digest_day_of_week <= 7),
  add column if not exists digest_location_id uuid references public.locations(id) on delete set null,
  add column if not exists digest_last_sent_at timestamptz;
