-- Add max_notifications to alert_rules for per-cooldown-cycle rate limiting.
--
-- Semantic (see src/engine/notificationCycle.ts for the full spec):
--   max_notifications = 0 → unlimited, use legacy cooldown semantic
--     (one fire per cooldown_hours window)
--   max_notifications > 0 → up to N fires within a single cooldown_hours
--     window. Counter resets when the cycle anchor (last_triggered_at) is
--     older than cooldown_hours. User-facing copy: "Maximum notifications
--     per cooldown period (0 = unlimited)".
--
-- Defaults to 0 so every existing rule keeps its current behavior
-- unchanged after the migration.

alter table public.alert_rules
  add column if not exists max_notifications int not null default 0,
  add column if not exists notifications_sent_count int not null default 0;

-- Sanity check: cap the value at a reasonable ceiling so a fat-finger
-- client can't create a rule that fires 10,000 times per cycle. The UI
-- enforces 0-10 but the DB is the final authority.
alter table public.alert_rules
  drop constraint if exists alert_rules_max_notifications_nonneg;
alter table public.alert_rules
  add constraint alert_rules_max_notifications_nonneg
  check (max_notifications >= 0 and max_notifications <= 100);

alter table public.alert_rules
  drop constraint if exists alert_rules_notifications_sent_count_nonneg;
alter table public.alert_rules
  add constraint alert_rules_notifications_sent_count_nonneg
  check (notifications_sent_count >= 0);
