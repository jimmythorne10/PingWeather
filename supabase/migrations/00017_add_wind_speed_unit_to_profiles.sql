-- Add wind_speed_unit to profiles so the server-side digest can format
-- wind values in the user's preferred unit.
--
-- temperature_unit was added in migration 00010. wind_speed_unit follows the
-- same pattern: the client writes it on change via authStore.updateProfile(),
-- the send-digest Edge Function reads it when formatting notification bodies.
--
-- Default 'mph' matches the Open-Meteo fetch unit used by poll-weather and
-- send-digest (wind data is always fetched in mph, then converted per-user).

alter table public.profiles
  add column wind_speed_unit text not null default 'mph'
    check (wind_speed_unit in ('mph', 'kmh', 'knots'));
