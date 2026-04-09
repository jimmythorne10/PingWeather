-- Add last_polled_at to alert_rules for accurate polling interval enforcement.
--
-- Before this column, poll-weather used `updated_at` as the "last poll time",
-- which was wrong for two reasons:
--   1. updated_at changes every time a user edits a rule — editing a rule
--      would reset its polling window.
--   2. updated_at changes when the alert-engine writes last_triggered_at,
--      meaning a triggered rule would be (incorrectly) treated as having
--      just been polled.
--
-- The correct semantic is "last time poll-weather processed this rule",
-- which is orthogonal to both edits and triggers. Write it unconditionally
-- every time the rule is evaluated, regardless of whether it triggered.

alter table public.alert_rules
  add column if not exists last_polled_at timestamptz;

-- Index for the due-rules filter: cron queries "rules where
-- last_polled_at is null OR last_polled_at + polling_interval_hours < now()".
-- Partial index on active rules keeps it tiny.
create index if not exists idx_alert_rules_last_polled_active
  on public.alert_rules (last_polled_at)
  where is_active = true;
