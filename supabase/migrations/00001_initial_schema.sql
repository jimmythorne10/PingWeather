-- ────────────────────────────────────────────────────────────
-- WeatherWatch Initial Schema
-- ────────────────────────────────────────────────────────────

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ────────────────────────────────────────────────────────────
-- PROFILES
-- Created automatically via trigger on auth.users insert
-- ────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  subscription_tier text not null default 'free' check (subscription_tier in ('free', 'pro', 'premium')),
  onboarding_completed boolean not null default false,
  eula_accepted_version text,
  eula_accepted_at timestamptz,
  push_token text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ────────────────────────────────────────────────────────────
-- LOCATIONS
-- ────────────────────────────────────────────────────────────
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  latitude double precision not null,
  longitude double precision not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.locations enable row level security;

create policy "Users can read own locations"
  on public.locations for select
  using (auth.uid() = user_id);

create policy "Users can insert own locations"
  on public.locations for insert
  with check (auth.uid() = user_id);

create policy "Users can update own locations"
  on public.locations for update
  using (auth.uid() = user_id);

create policy "Users can delete own locations"
  on public.locations for delete
  using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- ALERT RULES
-- ────────────────────────────────────────────────────────────
create table public.alert_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  name text not null,
  conditions jsonb not null, -- array of {metric, operator, value, unit}
  logical_operator text not null default 'AND' check (logical_operator in ('AND', 'OR')),
  lookahead_hours integer not null default 24,
  polling_interval_hours integer not null default 12,
  cooldown_hours integer not null default 12,
  is_active boolean not null default true,
  last_triggered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.alert_rules enable row level security;

create policy "Users can read own alert rules"
  on public.alert_rules for select
  using (auth.uid() = user_id);

create policy "Users can insert own alert rules"
  on public.alert_rules for insert
  with check (auth.uid() = user_id);

create policy "Users can update own alert rules"
  on public.alert_rules for update
  using (auth.uid() = user_id);

create policy "Users can delete own alert rules"
  on public.alert_rules for delete
  using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- ALERT HISTORY
-- ────────────────────────────────────────────────────────────
create table public.alert_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  rule_id uuid references public.alert_rules(id) on delete set null,
  rule_name text not null,
  location_name text not null,
  conditions_met text not null, -- human-readable summary
  forecast_data jsonb, -- snapshot of relevant forecast data
  triggered_at timestamptz not null default now(),
  notification_sent boolean not null default false
);

alter table public.alert_history enable row level security;

create policy "Users can read own alert history"
  on public.alert_history for select
  using (auth.uid() = user_id);

-- Service role inserts alert history (from Edge Functions)
-- No user-facing insert policy needed

-- Index for efficient history queries and cleanup
create index idx_alert_history_user_triggered
  on public.alert_history(user_id, triggered_at desc);

-- ────────────────────────────────────────────────────────────
-- UPDATED_AT TRIGGER
-- ────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger set_alert_rules_updated_at
  before update on public.alert_rules
  for each row execute function public.set_updated_at();
