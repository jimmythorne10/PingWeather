-- Add missing foreign key indexes on locations and alert_rules.
--
-- Without these, every query that joins alert_rules to locations or profiles
-- triggers a sequential scan of the child table. At MVP scale (tens of rows)
-- this is invisible. At 500+ users with multiple rules and locations each it
-- becomes the dominant query cost for the poll-weather and evaluate-alerts
-- hot path.
--
-- Postgres does NOT automatically index foreign key columns (unlike some other
-- databases). These must be added explicitly.

create index if not exists idx_locations_user_id
  on public.locations(user_id);

create index if not exists idx_alert_rules_location_id
  on public.alert_rules(location_id);

create index if not exists idx_alert_rules_user_id
  on public.alert_rules(user_id);
