-- Run fcm-keepalive once daily at 10:00 UTC.
-- Sends a silent background FCM ping to all registered devices to
-- prevent Android from deprioritizing the app on quiet alert days.
select
  cron.schedule(
    'fcm-keepalive-daily',
    '0 10 * * *',
    $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_url') || '/functions/v1/fcm-keepalive',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
      ),
      body := '{}'::jsonb
    );
    $$
  );
