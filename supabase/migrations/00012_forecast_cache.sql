-- Forecast cache — one row per grid square (0.1° resolution).
-- poll-weather upserts here after every Open-Meteo fetch.
-- send-digest reads from here instead of calling Open-Meteo again.
--
-- Grid key is "lat,lon" rounded to 0.1° (same formula as poll-weather's gridKey()).
-- Authenticated users can read any cache entry — forecast data is not sensitive.

create table if not exists public.forecast_cache (
  grid_key   text        primary key,
  latitude   double precision not null,
  longitude  double precision not null,
  forecast_json jsonb    not null,
  fetched_at timestamptz not null default now()
);

alter table public.forecast_cache enable row level security;

create policy "Authenticated users can read forecast cache"
  on public.forecast_cache for select
  using (auth.role() = 'authenticated');

create policy "Service role can upsert forecast cache"
  on public.forecast_cache for all
  using (true)
  with check (true);
