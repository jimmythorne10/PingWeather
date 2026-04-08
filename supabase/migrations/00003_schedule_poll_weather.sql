-- Schedule hourly polling of the poll-weather Edge Function via pg_cron.
--
-- Prerequisites (enabled once per project in Supabase Dashboard → Database → Extensions):
--   * pg_cron     — schedules cron jobs inside Postgres
--   * pg_net      — lets Postgres make outbound HTTP requests
--   * supabase_vault (a.k.a. "vault") — secure storage for the service_role key
--
-- Before applying this migration you MUST seed two vault secrets via the SQL editor
-- (do NOT put the real values into a migration file):
--
--   select vault.create_secret(
--     '<YOUR-SERVICE-ROLE-KEY>',
--     'poll_weather_service_role_key',
--     'Service role JWT used by pg_cron to call the poll-weather Edge Function'
--   );
--
--   select vault.create_secret(
--     'https://ziyxkgbrdliwvztotxli.supabase.co/functions/v1/poll-weather',
--     'poll_weather_function_url',
--     'Full URL of the poll-weather Edge Function'
--   );
--
-- Why hourly? pg_cron fires once per hour and the Edge Function itself decides
-- per-rule whether each rule's polling_interval_hours window has elapsed. Hourly
-- is the finest granularity any tier requires (Premium = 1hr minimum).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Unschedule any prior version of this job so re-running this migration is safe.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'poll-weather-hourly') then
    perform cron.unschedule('poll-weather-hourly');
  end if;
end $$;

select cron.schedule(
  'poll-weather-hourly',
  '0 * * * *',  -- top of every hour, UTC
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'poll_weather_function_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'poll_weather_service_role_key')
    ),
    body := jsonb_build_object('source', 'pg_cron')
  ) as request_id;
  $$
);

-- Verify: you can inspect recent runs with
--   select * from cron.job_run_details where jobname = 'poll-weather-hourly' order by start_time desc limit 20;
