-- Fix send-digest-hourly cron: use send_digest_auth_token from vault instead of
-- poll_weather_service_role_key. The service role key in vault doesn't match the
-- SUPABASE_SERVICE_ROLE_KEY env var seen inside the function (root cause unknown),
-- causing every scheduled invocation to return 401.
--
-- send-digest accepts two auth paths:
--   1. Bearer ${SUPABASE_SERVICE_ROLE_KEY}  (module-level const in function)
--   2. Bearer ${SEND_DIGEST_SECRET}          (read per-request from function secret)
--
-- The cron uses path 2 via the send_digest_auth_token vault secret.
--
-- PREREQUISITE: send_digest_auth_token vault value MUST match the SEND_DIGEST_SECRET
-- function secret. Sync them at:
--   Dashboard → Project Settings → Vault → send_digest_auth_token
-- Set it to the same value as the SEND_DIGEST_SECRET function secret.

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
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'send_digest_auth_token')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) as request_id;
  $$
);

-- Verify:
-- select jobname, command from cron.job where jobname = 'send-digest-hourly';
-- The command should reference send_digest_auth_token, not poll_weather_service_role_key.
