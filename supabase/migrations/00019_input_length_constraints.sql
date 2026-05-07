-- Prevent oversized inputs on user-controlled text fields.
alter table public.alert_rules
  add constraint alert_rules_name_length check (char_length(name) <= 200);

alter table public.locations
  add constraint locations_name_length check (char_length(name) <= 200);

alter table public.alert_rules
  add constraint alert_rules_conditions_size check (pg_column_size(conditions) <= 65536);
