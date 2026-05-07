-- Drop the open SELECT policy on forecast_cache.
-- service_role (send-digest) bypasses RLS entirely; no client reads this table.
drop policy if exists "Authenticated users can read forecast cache" on public.forecast_cache;
