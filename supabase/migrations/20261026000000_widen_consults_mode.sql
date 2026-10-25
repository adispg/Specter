-- consults.mode was constrained to the three original modes. Adding meta and
-- clarify to MODES in lib/consult/schema.ts without widening this check meant
-- every capability question and every too-thin input would pass validation and
-- then 500 on insert: the modes added to stop those inputs failing would have
-- made them fail harder.
--
-- Keep this list in step with MODES in lib/consult/schema.ts.

alter table public.consults drop constraint if exists consults_mode_check;

alter table public.consults
  add constraint consults_mode_check
  check (mode in ('persona', 'care', 'decline', 'meta', 'clarify'));

comment on constraint consults_mode_check on public.consults is
  'Must stay in step with MODES in lib/consult/schema.ts. meta covers capability questions and greetings; clarify covers input too thin to answer without inventing facts.';
