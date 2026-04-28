-- Fix send-digest and fcm-keepalive cron jobs that have been silently failing
-- since migrations 00009 and 00011 were applied.
--
-- Root cause: both jobs referenced vault secrets named 'supabase_url' and
-- 'service_role_key'. These secrets were never created. The vault only contains
-- 'poll_weather_function_url' and 'poll_weather_service_role_key' (seeded before
-- migration 00003). Every cron execution has been posting to a NULL URL, which
-- pg_net silently discards. send-digest has NEVER fired. fcm-keepalive has NEVER
-- fired.
--
-- Fix strategy: derive the function URL by regex-replacing the function name at
-- the tail of poll_weather_function_url. This avoids seeding new vault secrets
-- (the base URL and key are already there) and is self-consistent — if the
-- Supabase project URL ever changes, only one vault secret needs updating.
--
-- Example derivation:
--   'https://ziyxkgbrdliwvztotxli.supabase.co/functions/v1/poll-weather'
--     → 'https://ziyxkgbrdliwvztotxli.supabase.co/functions/v1/send-digest'
--
-- Both jobs also gain timeout_milliseconds := 30000 to match the poll-weather
-- job hardened in migration 00007.

-- ── send-digest: reschedule with correct vault secrets ───────────────────────
do $$
begin
  if exists (select 1 from cron.job where jobname = 'send-digest-hourly') then
    perform cron.unschedule('send-digest-hourly');
  end if;
end $$;

select cron.schedule(
  'send-digest-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := regexp_replace(
      (select decrypted_secret from vault.decrypted_secrets where name = 'poll_weather_function_url'),
      'poll-weather$',
      'send-digest'
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'poll_weather_service_role_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) as request_id;
  $$
);

-- ── fcm-keepalive: reschedule with correct vault secrets ─────────────────────
do $$
begin
  if exists (select 1 from cron.job where jobname = 'fcm-keepalive-daily') then
    perform cron.unschedule('fcm-keepalive-daily');
  end if;
end $$;

select cron.schedule(
  'fcm-keepalive-daily',
  '0 10 * * *',
  $$
  select net.http_post(
    url := regexp_replace(
      (select decrypted_secret from vault.decrypted_secrets where name = 'poll_weather_function_url'),
      'poll-weather$',
      'fcm-keepalive'
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'poll_weather_service_role_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) as request_id;
  $$
);

-- Verify after applying:
--   select jobname, command from cron.job
--   where jobname in ('send-digest-hourly', 'fcm-keepalive-daily');
-- The command column should show the regexp_replace expression, not a NULL URL literal.
