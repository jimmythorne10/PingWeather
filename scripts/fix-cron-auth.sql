-- Fix cron auth: store dedicated secrets in vault, reschedule cron jobs.
-- poll_weather_service_role_key in vault != SUPABASE_SERVICE_ROLE_KEY in Deno,
-- so cron now passes POLL_WEATHER_SECRET / SEND_DIGEST_SECRET instead.

-- Add vault entries for the dedicated cron secrets (idempotent via WHERE NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'poll_weather_auth_token') THEN
    PERFORM vault.create_secret('ping-poll-weather-2026', 'poll_weather_auth_token');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'send_digest_auth_token') THEN
    PERFORM vault.create_secret('ping-digest-test-2026', 'send_digest_auth_token');
  END IF;
END $$;

-- Reschedule poll-weather cron using the new auth token
SELECT cron.unschedule('poll-weather-hourly');
SELECT cron.schedule(
  'poll-weather-hourly',
  '0 * * * *',
  format(
    $SQL$
    SELECT net.http_post(
      url := %L,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'poll_weather_auth_token')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    )
    $SQL$,
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'poll_weather_function_url')
  )
);

-- Reschedule send-digest cron using the new auth token
SELECT cron.unschedule('send-digest-hourly');
SELECT cron.schedule(
  'send-digest-hourly',
  '0 * * * *',
  format(
    $SQL$
    SELECT net.http_post(
      url := %L,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'send_digest_auth_token')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    )
    $SQL$,
    regexp_replace(
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'poll_weather_function_url'),
      '/poll-weather$', '/send-digest'
    )
  )
);
