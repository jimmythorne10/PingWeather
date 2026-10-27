-- User feedback ("What matters most to you?").
-- Users may INSERT their own rows only. No select/update/delete policy exists,
-- so RLS denies all reads from the app; the operator reads via the dashboard
-- (service role). Rows cascade-delete with the profile, as the privacy policy
-- promises.

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  priorities text[] not null default '{}',
  message text,
  contact_ok boolean not null default false,
  app_version text,
  platform text,
  subscription_tier text,
  created_at timestamptz not null default now(),
  constraint feedback_message_length check (message is null or char_length(message) <= 2000),
  constraint feedback_priorities_count check (cardinality(priorities) <= 20),
  constraint feedback_not_empty check (cardinality(priorities) > 0 or message is not null)
);

create index feedback_created_at_idx on public.feedback (created_at desc);
create index feedback_user_id_idx on public.feedback (user_id);

alter table public.feedback enable row level security;

create policy "Users can insert own feedback"
  on public.feedback for insert
  with check (auth.uid() = user_id);
