-- Raise the pg_net timeout on the poll-weather cron job from the default
-- 5s to 30s.
--
-- The scheduled cron hit a "Timeout of 5000 ms reached" on its first real
-- run (row 10 in net._http_response, 2026-04-09 03:00 UTC) even though the
-- function completed successfully server-side in ~2.4s. pg_net was giving
-- up before Cloudflare's upstream response arrived. 30s is a comfortable
-- ceiling that lets poll-weather scale from 2 locations to ~50 without
-- needing another migration. The function's own Deno runtime will time
-- out far sooner anyway if it gets genuinely stuck.
--
-- Implementation: unschedule the old job and reschedule with the same
-- name + schedule, just with a different command body that includes
-- `timeout_milliseconds`.

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
    body := jsonb_build_object('source', 'pg_cron'),
    timeout_milliseconds := 30000
  ) as request_id;
  $$
);

-- Verify: the next cron run should produce a net._http_response row with
-- a real status_code and body, not a null row with "Timeout of 5000 ms
-- reached" in error_msg.
