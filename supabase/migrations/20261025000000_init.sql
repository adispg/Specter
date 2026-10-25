-- Specter: initial schema (follows docs/PRD.md section 12).
-- Tables: profiles, cases, consults, saved_lines, feedback, usage_events,
-- safety_events, audio_cache, guest_usage.
-- Every user table has Row Level Security; users only read and write their own rows.
-- Persona keys are neutral slots ('closer', 'prodigy', 'insider'), never character
-- names, so the cast can be renamed or swapped without touching stored data.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user (including anonymous guests), created by trigger.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 80),
  locale text check (locale is null or char_length(locale) <= 35),
  country text check (country is null or country ~ '^[A-Z]{2}$'),
  age_confirmed_at timestamptz,
  disclosure_ack_at timestamptz,
  onboarded_at timestamptz,
  settings jsonb not null default '{"speak": true, "pace": 1, "intensity": "sharp", "persona": "closer", "readPlay": false, "voices": {}}'::jsonb,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  plan_renews_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- cases: one situation. Persona neutral; persona/intensity record who opened it.
-- ---------------------------------------------------------------------------
create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  persona text not null check (persona in ('closer', 'prodigy', 'insider')),
  intensity text not null default 'sharp' check (intensity in ('measured', 'sharp', 'nomercy')),
  situation text not null check (char_length(situation) between 1 and 4000),
  title text check (title is null or char_length(title) <= 120),
  intent text,
  stakes text check (stakes is null or stakes in ('low', 'medium', 'high')),
  moment_at timestamptz,
  debrief_status text not null default 'none' check (debrief_status in ('none', 'used', 'partly', 'not_used')),
  debrief_note text check (debrief_note is null or char_length(debrief_note) <= 1000),
  last_activity_at timestamptz not null default now(),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cases_user_activity_idx on public.cases (user_id, last_activity_at desc);

-- ---------------------------------------------------------------------------
-- consults: one persona answer on a case (initial, followup, another, switch),
-- with the user's input and the validated reply.
-- ---------------------------------------------------------------------------
create table if not exists public.consults (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  persona text not null check (persona in ('closer', 'prodigy', 'insider')),
  kind text not null check (kind in ('initial', 'followup', 'another', 'switch')),
  user_input text check (user_input is null or char_length(user_input) <= 4000),
  spoken boolean not null default false,
  reply jsonb not null,
  mode text not null check (mode in ('persona', 'care', 'decline')),
  intensity text not null check (intensity in ('measured', 'sharp', 'nomercy')),
  model text not null,
  prompt_version text not null,
  latency_ms integer,
  tokens_in integer,
  tokens_out integer,
  cache_read_tokens integer,
  tts_chars integer,
  error_code text,
  created_at timestamptz not null default now()
);
create index if not exists consults_case_created_idx on public.consults (case_id, created_at);
create index if not exists consults_user_created_idx on public.consults (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- saved_lines: lines the user kept. Deleted with their consult (and so with the case).
-- ---------------------------------------------------------------------------
create table if not exists public.saved_lines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  case_id uuid references public.cases (id) on delete cascade,
  consult_id uuid references public.consults (id) on delete cascade,
  persona text not null check (persona in ('closer', 'prodigy', 'insider')),
  line_marked text not null check (char_length(line_marked) <= 400),
  line_text text not null check (char_length(line_text) <= 400),
  followup_text text check (followup_text is null or char_length(followup_text) <= 600),
  matter text check (matter is null or char_length(matter) <= 120),
  created_at timestamptz not null default now(),
  unique (user_id, consult_id)
);
create index if not exists saved_lines_user_created_idx on public.saved_lines (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- feedback: thumbs per consult.
-- ---------------------------------------------------------------------------
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  consult_id uuid not null references public.consults (id) on delete cascade,
  rating text not null check (rating in ('up', 'down')),
  reason text check (reason is null or reason in ('too_long', 'off_target', 'not_their_voice', 'unsafe', 'other')),
  note text check (note is null or char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, consult_id)
);

-- ---------------------------------------------------------------------------
-- usage_events: metering for the weekly free tier, daily hard caps and metrics.
-- Users may insert and read their own events but never update or delete them,
-- so a quota cannot be reset from the client.
-- ---------------------------------------------------------------------------
create table if not exists public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('consult', 'tts', 'stt')),
  billable boolean not null default true,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists usage_events_user_kind_created_idx on public.usage_events (user_id, kind, created_at desc);

-- ---------------------------------------------------------------------------
-- safety_events: minimal record of care mode and declines. No situation text.
-- Survives account deletion with user_id set to null (aggregate safety metrics).
-- ---------------------------------------------------------------------------
create table if not exists public.safety_events (
  id bigint generated always as identity primary key,
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  consult_id uuid references public.consults (id) on delete set null,
  category text not null check (category in ('crisis', 'self_harm', 'violence', 'illegal_request', 'abuse', 'minor_suspected')),
  action text not null check (action in ('care_mode', 'decline')),
  locale text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- audio_cache: TTS audio keyed by hash of (text, voice, speed, model) so replays are free.
-- ---------------------------------------------------------------------------
create table if not exists public.audio_cache (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  hash text not null,
  case_id uuid references public.cases (id) on delete cascade,
  mime text not null,
  audio_b64 text not null,
  timeline jsonb not null,
  chars integer not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  primary key (user_id, hash)
);
create index if not exists audio_cache_last_used_idx on public.audio_cache (last_used_at);

-- ---------------------------------------------------------------------------
-- guest_usage: device and IP throttle for guest consults (hashed keys only).
-- No direct access; only through consume_guest_quota().
-- ---------------------------------------------------------------------------
create table if not exists public.guest_usage (
  id bigint generated always as identity primary key,
  key_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists guest_usage_key_created_idx on public.guest_usage (key_hash, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists cases_set_updated_at on public.cases;
create trigger cases_set_updated_at before update on public.cases for each row execute function public.set_updated_at();
drop trigger if exists feedback_set_updated_at on public.feedback;
create trigger feedback_set_updated_at before update on public.feedback for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Create a profile for every new auth user (anonymous guests included).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.cases enable row level security;
alter table public.consults enable row level security;
alter table public.saved_lines enable row level security;
alter table public.feedback enable row level security;
alter table public.usage_events enable row level security;
alter table public.safety_events enable row level security;
alter table public.audio_cache enable row level security;
alter table public.guest_usage enable row level security; -- no policies: no direct access

-- profiles
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated using (id = (select auth.uid()));
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert to authenticated with check (id = (select auth.uid()));
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Users must not upgrade their own plan.
create or replace function public.protect_profile_plan() returns trigger
language plpgsql as $$
begin
  if (select auth.role()) = 'authenticated' and (new.plan is distinct from old.plan or new.plan_renews_at is distinct from old.plan_renews_at) then
    raise exception 'plan can only be changed by the billing system';
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_protect_plan on public.profiles;
create trigger profiles_protect_plan before update on public.profiles for each row execute function public.protect_profile_plan();

-- cases
drop policy if exists cases_select_own on public.cases;
create policy cases_select_own on public.cases for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists cases_insert_own on public.cases;
create policy cases_insert_own on public.cases for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists cases_update_own on public.cases;
create policy cases_update_own on public.cases for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists cases_delete_own on public.cases;
create policy cases_delete_own on public.cases for delete to authenticated using (user_id = (select auth.uid()));

-- consults: own rows, and only on own cases
drop policy if exists consults_select_own on public.consults;
create policy consults_select_own on public.consults for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists consults_insert_own on public.consults;
create policy consults_insert_own on public.consults for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.cases c where c.id = case_id and c.user_id = (select auth.uid())));
drop policy if exists consults_delete_own on public.consults;
create policy consults_delete_own on public.consults for delete to authenticated using (user_id = (select auth.uid()));

-- saved_lines
drop policy if exists saved_lines_select_own on public.saved_lines;
create policy saved_lines_select_own on public.saved_lines for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists saved_lines_insert_own on public.saved_lines;
create policy saved_lines_insert_own on public.saved_lines for insert to authenticated
  with check (user_id = (select auth.uid())
    and (consult_id is null or exists (select 1 from public.consults c where c.id = consult_id and c.user_id = (select auth.uid()))));
drop policy if exists saved_lines_delete_own on public.saved_lines;
create policy saved_lines_delete_own on public.saved_lines for delete to authenticated using (user_id = (select auth.uid()));

-- feedback
drop policy if exists feedback_select_own on public.feedback;
create policy feedback_select_own on public.feedback for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists feedback_insert_own on public.feedback;
create policy feedback_insert_own on public.feedback for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.consults c where c.id = consult_id and c.user_id = (select auth.uid())));
drop policy if exists feedback_update_own on public.feedback;
create policy feedback_update_own on public.feedback for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- usage_events: insert and read own; no update, no delete
drop policy if exists usage_events_select_own on public.usage_events;
create policy usage_events_select_own on public.usage_events for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists usage_events_insert_own on public.usage_events;
create policy usage_events_insert_own on public.usage_events for insert to authenticated with check (user_id = (select auth.uid()));

-- safety_events: insert own only (read by admins with the service role)
drop policy if exists safety_events_insert_own on public.safety_events;
create policy safety_events_insert_own on public.safety_events for insert to authenticated with check (user_id = (select auth.uid()));

-- audio_cache
drop policy if exists audio_cache_select_own on public.audio_cache;
create policy audio_cache_select_own on public.audio_cache for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists audio_cache_insert_own on public.audio_cache;
create policy audio_cache_insert_own on public.audio_cache for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists audio_cache_update_own on public.audio_cache;
create policy audio_cache_update_own on public.audio_cache for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists audio_cache_delete_own on public.audio_cache;
create policy audio_cache_delete_own on public.audio_cache for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Guest throttle: atomically consume one guest consult for a hashed device or IP
-- key, if under the limit in the window. security definer so guests never see
-- the table.
-- ---------------------------------------------------------------------------
create or replace function public.consume_guest_quota(p_key text, p_limit integer, p_window_hours integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  used integer;
begin
  if auth.uid() is null then
    return false;
  end if;
  perform pg_advisory_xact_lock(hashtext(p_key));
  select count(*) into used from public.guest_usage
    where key_hash = p_key and created_at > now() - make_interval(hours => p_window_hours);
  if used >= p_limit then
    return false;
  end if;
  insert into public.guest_usage (key_hash) values (p_key);
  delete from public.guest_usage where created_at < now() - interval '7 days';
  return true;
end;
$$;
revoke all on function public.consume_guest_quota(text, integer, integer) from public, anon;
grant execute on function public.consume_guest_quota(text, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Account deletion. Deleting the auth user cascades to every table above.
-- security definer so the signed-in user can remove their own auth row without a
-- service-role key in the app; it can only ever delete auth.uid().
-- ---------------------------------------------------------------------------
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  delete from auth.users where id = uid;
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
