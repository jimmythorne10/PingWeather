-- Revert 00005_add_max_notifications_to_alert_rules.sql
--
-- The "max_notifications per cooldown cycle" feature was removed 2026-04-09
-- after device testing revealed the semantic was the opposite of what we
-- intended: setting a cap > 0 made the rule fire MORE often than the
-- default unlimited mode (which uses "one fire per cooldown window"), not
-- fewer. Rather than re-spin a different semantic under the same feature
-- name and confuse users, we're removing the feature entirely and going
-- back to the simple cooldown-only gate.
--
-- Dropping the columns (not just ignoring them) so the schema accurately
-- reflects the product. No user-facing data is lost — notifications_sent_count
-- was an internal cycle counter, max_notifications was always 0 (default)
-- for any production rule because the UI was only device-tested.
--
-- Keeps last_polled_at from migration 00004 — that's the separate
-- "track when the rule was last polled" fix, unrelated to this feature.

alter table public.alert_rules
  drop constraint if exists alert_rules_max_notifications_nonneg;

alter table public.alert_rules
  drop constraint if exists alert_rules_notifications_sent_count_nonneg;

alter table public.alert_rules
  drop column if exists max_notifications,
  drop column if exists notifications_sent_count;
