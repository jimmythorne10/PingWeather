SELECT net.http_post(
  url := regexp_replace(
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'poll_weather_function_url'),
    '/poll-weather$', '/send-digest'
  ),
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'poll_weather_service_role_key')
  ),
  body := '{"notifyNow":true,"userId":"18b9304b-b1ae-4d3b-9506-b0bbe3e06973"}'::jsonb
) AS request_id;
