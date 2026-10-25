-- Guest quota was consumed before the model was called, so any later failure
-- (a provider 503, a schema failure, a timeout) spent the attempt and created
-- nothing. Observed in production: guest_usage held rows while cases held none.
-- With a per-device allowance of one, a single provider outage permanently
-- burned a first-time visitor's only try, which is the first-run path.
--
-- Consuming up front is still correct: it is atomic under the advisory lock and
-- stops two concurrent requests both slipping through. What was missing is the
-- refund. This gives one back, newest first, so a failed consult costs nothing.

create or replace function public.release_guest_quota(p_key text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  victim bigint;
begin
  if auth.uid() is null then
    return false;
  end if;
  perform pg_advisory_xact_lock(hashtext(p_key));
  -- Newest row for this key only, so a refund can never delete someone else's
  -- usage or an older entry that a different request is relying on.
  select id into victim from public.guest_usage
    where key_hash = p_key
    order by created_at desc, id desc
    limit 1;
  if victim is null then
    return false;
  end if;
  delete from public.guest_usage where id = victim;
  return true;
end;
$$;

revoke all on function public.release_guest_quota(text) from public, anon;
grant execute on function public.release_guest_quota(text) to authenticated;
