-- persist() wrote the case and its first consult as two independent
-- statements. A failure between them left a case row with no consult, which
-- shows in the user's list as an entry that opens to nothing, and the request
-- returned a 500 after the model had already been paid for.
--
-- This inserts both in one transaction. A function body is a single
-- transaction, so either both rows exist or neither does.
--
-- security definer with a locked search_path, matching consume_guest_quota and
-- release_guest_quota. It can only ever write rows owned by auth.uid(), which
-- is set here rather than taken from the caller, so it cannot be used to write
-- into someone else's account.

create or replace function public.create_case_with_consult(
  p_case jsonb,
  p_consult jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  new_case public.cases;
  new_consult public.consults;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  insert into public.cases (user_id, persona, intensity, situation, title, intent, stakes)
  values (
    uid,
    p_case ->> 'persona',
    coalesce(p_case ->> 'intensity', 'sharp'),
    p_case ->> 'situation',
    nullif(p_case ->> 'title', ''),
    nullif(p_case ->> 'intent', ''),
    nullif(p_case ->> 'stakes', '')
  )
  returning * into new_case;

  insert into public.consults (
    case_id, user_id, persona, kind, user_input, spoken, reply, mode, intensity,
    model, prompt_version, latency_ms, tokens_in, tokens_out, cache_read_tokens
  )
  values (
    new_case.id,
    uid,
    p_consult ->> 'persona',
    p_consult ->> 'kind',
    nullif(p_consult ->> 'user_input', ''),
    coalesce((p_consult ->> 'spoken')::boolean, false),
    p_consult -> 'reply',
    p_consult ->> 'mode',
    p_consult ->> 'intensity',
    p_consult ->> 'model',
    p_consult ->> 'prompt_version',
    (p_consult ->> 'latency_ms')::integer,
    (p_consult ->> 'tokens_in')::integer,
    (p_consult ->> 'tokens_out')::integer,
    (p_consult ->> 'cache_read_tokens')::integer
  )
  returning * into new_consult;

  return jsonb_build_object('case', to_jsonb(new_case), 'consult', to_jsonb(new_consult));
end;
$$;

revoke all on function public.create_case_with_consult(jsonb, jsonb) from public, anon;
grant execute on function public.create_case_with_consult(jsonb, jsonb) to authenticated;
