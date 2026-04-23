-- Store user's temperature unit preference on profile so server-side
-- functions (send-digest) can format notifications in the correct unit.
alter table public.profiles
  add column if not exists temperature_unit text not null default 'fahrenheit'
    check (temperature_unit in ('fahrenheit', 'celsius'));
