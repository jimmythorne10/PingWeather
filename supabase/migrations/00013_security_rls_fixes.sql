-- Security hardening: add WITH CHECK to UPDATE policies and drop world-writable policies.
--
-- Three classes of bugs fixed here:
--
-- 1. profiles UPDATE had no WITH CHECK — any authenticated user could set their own
--    subscription_tier to 'premium' with a direct REST call, bypassing RevenueCat.
--    The new policy locks subscription_tier to its current stored value; only
--    service_role (which bypasses RLS entirely) can change it.
--
-- 2. forecast_cache had a FOR ALL policy with USING(true)/WITH CHECK(true). This gave
--    every authenticated user write access to the cache. Service_role already bypasses
--    RLS, so no write policy is needed at all. The read-only policy is sufficient.
--
-- 3. locations and alert_rules UPDATE policies had no WITH CHECK, so a user could
--    reassign a row to a different user_id after the fact. The WITH CHECK constrains
--    the new row's user_id, not just the row being selected for update.

-- ── profiles: lock subscription_tier against self-escalation ─────────────────
drop policy "Users can update own profile" on public.profiles;

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and subscription_tier = (select subscription_tier from public.profiles where id = auth.uid())
  );

-- ── forecast_cache: drop the world-writable policy ───────────────────────────
-- service_role bypasses RLS — it does not need an explicit write policy.
-- Leaving FOR ALL USING(true) open means any authenticated user can corrupt or
-- overwrite cached forecast data.
drop policy "Service role can upsert forecast cache" on public.forecast_cache;

-- ── locations: prevent user_id reassignment via UPDATE ───────────────────────
drop policy "Users can update own locations" on public.locations;

create policy "Users can update own locations"
  on public.locations for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── alert_rules: prevent user_id reassignment via UPDATE ─────────────────────
drop policy "Users can update own alert rules" on public.alert_rules;

create policy "Users can update own alert rules"
  on public.alert_rules for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── alert_rules: enforce sane numeric bounds at the DB layer ─────────────────
-- The app enforces tier limits, but the database should reject nonsensical values
-- regardless of what the client sends (e.g. via direct REST).
-- cooldown_hours >= 1 prevents polling storm if a client submits 0.
-- polling_interval_hours >= 1 matches the Premium tier minimum (1hr).
-- lookahead_hours 1-168 = 1hr minimum, 7-day maximum (Open-Meteo limit).
alter table public.alert_rules
  add constraint alert_rules_cooldown_min check (cooldown_hours >= 1),
  add constraint alert_rules_polling_min check (polling_interval_hours >= 1),
  add constraint alert_rules_lookahead_range check (lookahead_hours between 1 and 168);

-- ── locations: enforce coordinate range at the DB layer ──────────────────────
-- Malformed coordinates would cause Open-Meteo API errors that are hard to trace
-- back to a bad DB row. Fail fast here instead.
alter table public.locations
  add constraint locations_latitude_range check (latitude between -90 and 90),
  add constraint locations_longitude_range check (longitude between -180 and 180);
