-- Alert history: deduplication index, user delete policy, and retention cleanup.
--
-- Three improvements bundled here:
--
-- 1. Dedup index: pg_cron fires poll-weather at the top of every hour. If the
--    function is slow and pg_net retries, or if a future architecture change
--    calls evaluate-alerts twice in the same hour, duplicate alert_history rows
--    would fire duplicate push notifications to the user. The unique index on
--    (rule_id, hour bucket) lets the evaluate-alerts INSERT use ON CONFLICT DO
--    NOTHING as a free dedup layer without any application-level locking.
--    Partial index (WHERE rule_id IS NOT NULL) to exclude manually-created rows
--    that have no rule association.
--
-- 2. User delete policy: GDPR/CCPA require that users can erase their own
--    data on request. The delete-account Edge Function handles account deletion,
--    but users should also be able to clear their alert history independently
--    (e.g. from the History screen). Service_role can already delete any row.
--
-- 3. Retention cleanup: the Premium tier has a 90-day history window. Rows older
--    than 90 days have no tier that can display them, so they're pure storage cost.
--    The 3:00 AM UTC schedule avoids overlap with the poll-weather hourly job.

-- ── 1. Dedup index ────────────────────────────────────────────────────────────
-- date_trunc('hour', timestamptz) is STABLE in Postgres, not IMMUTABLE, because
-- it is timezone-sensitive. Index expressions must be IMMUTABLE. The fix is an
-- IMMUTABLE wrapper that truncates to the UTC hour by casting to timestamp first
-- (AT TIME ZONE 'UTC' returns a plain timestamp, which date_trunc handles as
-- IMMUTABLE). This gives us a dedup bucket of "same rule, same UTC hour".
create or replace function public.triggered_at_hour_utc(ts timestamptz)
  returns timestamp
  language sql
  immutable parallel safe
  as $$ select date_trunc('hour', ts at time zone 'UTC'); $$;

create unique index if not exists idx_alert_history_dedup
  on public.alert_history (rule_id, public.triggered_at_hour_utc(triggered_at))
  where rule_id is not null;

-- ── 2. User delete policy ─────────────────────────────────────────────────────
create policy "Users can delete own alert history"
  on public.alert_history for delete
  using (auth.uid() = user_id);

-- ── 3. Retention cleanup cron ─────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from cron.job where jobname = 'alert-history-cleanup') then
    perform cron.unschedule('alert-history-cleanup');
  end if;
end $$;

select cron.schedule(
  'alert-history-cleanup',
  '0 3 * * *',
  $$ delete from public.alert_history where triggered_at < now() - interval '90 days'; $$
);
