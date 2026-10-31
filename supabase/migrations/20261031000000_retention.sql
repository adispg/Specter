-- ---------------------------------------------------------------------------
-- Retention: keep tables from growing without bound.
--
-- Strategy: a security-definer function that deletes stale rows, called
-- opportunistically from the app on ~1% of consult requests (fire-and-forget,
-- never blocks a user). The same function is also scheduled via pg_cron when
-- that extension is available (nightly at 03:17 UTC, minute is jittered to
-- spread load across the hour).
--
-- Thresholds
--   audio_cache   30 days since last_used_at  (TTS replay cache; frees storage)
--   usage_events  90 days since created_at    (quota window is 7d; 90d keeps
--                                              plenty of history for metrics)
--   guest_usage   7  days since created_at    (already cleaned in consume_guest_
--                                              quota; this is a belt-and-suspenders
--                                              pass for stale rows that slipped
--                                              through low-traffic periods)
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- purge_stale_data(): callable by the app user (service-role is not needed).
-- Uses security definer so the anon/authenticated caller never needs direct
-- DELETE on these tables.
-- ---------------------------------------------------------------------------
create or replace function public.purge_stale_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- TTS cache: entries not replayed in 30 days are unlikely to be replayed again.
  delete from public.audio_cache
    where last_used_at < now() - interval '30 days';

  -- Usage metering: the longest quota window is 7 days; 90 days gives ample
  -- headroom for analytics queries without keeping rows forever.
  delete from public.usage_events
    where created_at < now() - interval '90 days';

  -- Guest throttle belt-and-suspenders: consume_guest_quota already prunes rows
  -- older than 7 days on every guest consult, but quiet periods can leave
  -- lingering rows. Delete anything older than the maximum window (24 hours
  -- in practice; 7 days keeps a comfortable margin).
  delete from public.guest_usage
    where created_at < now() - interval '7 days';
end;
$$;

-- Revoke broad grants then grant only to the roles that need it.
-- service_role always bypasses RLS so it can call anything; explicit grants
-- here are for the authenticated and anon roles used by the app.
revoke all on function public.purge_stale_data() from public, anon;
grant execute on function public.purge_stale_data() to authenticated;

-- ---------------------------------------------------------------------------
-- pg_cron schedule (runs only when the extension is installed).
-- The DO block silently skips scheduling if pg_cron is not available, so the
-- migration applies cleanly on any Supabase tier.
-- ---------------------------------------------------------------------------
do $$
begin
  -- Check whether pg_cron is installed before touching the cron schema.
  if exists (
    select 1 from pg_extension where extname = 'pg_cron'
  ) then
    -- Unschedule any previous version of this job before (re-)adding it, so
    -- re-running the migration is idempotent.
    perform cron.unschedule('specter-purge-stale-data');
    perform cron.schedule(
      'specter-purge-stale-data',  -- job name
      '17 3 * * *',                -- nightly at 03:17 UTC
      $$select public.purge_stale_data()$$
    );
  end if;
exception
  when others then
    -- If pg_cron raises (e.g. permission issue), log and continue rather than
    -- failing the whole migration.
    raise warning 'pg_cron scheduling skipped: %', sqlerrm;
end;
$$;
