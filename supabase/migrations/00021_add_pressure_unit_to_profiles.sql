-- Add pressure_unit to profiles so the user's barometric pressure preference
-- is persisted to the database and survives logout / reinstall.
--
-- temperature_unit was added in migration 00010.
-- wind_speed_unit was added in migration 00017.
-- pressure_unit follows the same pattern: the client writes it on change via
-- authStore.updateProfile({ pressure_unit }), the value is read back on
-- fetchProfile and synced to settingsStore.
--
-- Default 'hPa' matches the existing settingsStore default and Open-Meteo's
-- native output unit.

alter table public.profiles
  add column pressure_unit text not null default 'hPa'
    check (pressure_unit in ('hPa', 'inHg'));
