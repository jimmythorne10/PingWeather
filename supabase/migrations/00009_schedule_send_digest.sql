-- Schedule send-digest to run every hour alongside poll-weather
-- send-digest internally checks which users are due based on their local hour
select
  cron.schedule(
    'send-digest-hourly',
    '0 * * * *',
    $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_url') || '/functions/v1/send-digest',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
      ),
      body := '{}'::jsonb
    );
    $$
  );
