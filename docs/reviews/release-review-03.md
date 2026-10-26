# Release Review 03: Specter App

**Date:** 2026-10-26
**Reviewer:** PM Agent (automated, unattended overnight run)
**Branch:** `fix/release-review-02-backlog` at e624565
**Base:** `main` at a407324
**Preview:** https://specter-git-fix-release-review-02-backlog-adityaguptaiiml-4524.vercel.app
**Build:** READY on Vercel (dpl_G1Gyk27S8o9gQqksWzbyNwmJ6NH6), clean locally
**QA:** docs/qa/qa-report-02.md, all ten checks PASS
**Previous verdict:** BLOCKED (release-review-02, P0 deploy failure and P1 auth config)
**This verdict:** BLOCKED for public sharing. Ready for your own testing of the first
reply loop only. One new P0 (an approved screen was never built), one P1 carried over,
one quality gate never run.

---

## Summary

Review 02's P0 is gone, its dev-owned P2 and N backlog is closed, and the two gates
that PROCESS.md requires but that have never actually run, e2e and the persona
harness, now run and pass. The harness in particular was reporting 0 of 181 before
tonight, which meant the release process had a gate that could only ever say no.

The more significant finding is what running the app turned up that reading it did
not. Five defects shipped to production and survived two source-code reviews, a clean build
and a clean typecheck. Four are fixed on this branch, one of which broke two of the six
screens for any user who had actually used the app.

The fourth is the headline and it is why this review is still BLOCKED. Every
follow-up action on the result screen is inert: new take, ask another persona, and the
push back composer all do nothing at all. Not an error, not a slow response. Nothing.
The screen they are supposed to navigate to, the case thread, was specified in
screens.md, signed off in design review 02, and never built. That is the entire
"keep talking to Harvey" loop, which is the product's whole reason to come back a
second time.

What has not changed: real sign-in is still blocked on Supabase configuration that
only you can do, and nothing here says anything about whether the advice is any good,
because every test ran against fixtures.

---

## What moved since review 02

| Review 02 item | State now |
|---|---|
| P0-A, Vercel deploy ERROR on b6a493e | **Resolved**, before this branch. Diagnosis below |
| P1-A, Supabase Auth redirect URLs | **Open**, yours |
| P2-A, loading skeletons per segment | **Done**, verified live |
| P2-B, branded 404 | **Done** on this branch |
| P2-C / P2-F / N3, inert mic on home | **Done**, verified from both sides |
| P2-D, stacked bottom nav on the result screen | **Done**, verified live |
| P2-E, guest tracking in sessionStorage | No action, as reviewed |
| N1, `GUEST_HASH_SALT` | **Open**, yours |
| N2, stale `ANTHROPIC_MODEL` | **Open**, yours |
| N4, `screen` versus `scr` | **Done** on this branch |
| N5, PWA offline fallback | **Done**, verified live |

---

## P0-B: the case thread was never built, so every follow-up is dead

This is the one to read first.

On the result screen, "New take", "Ask Mike", "Ask Donna" and the composer's push back
all call `goThread`, which stashes the request with `setPending` and routes to
`/cases/[id]`, which is the screen the user is already looking at. Nothing in the
codebase calls `takePending`. The request is discarded.

Verified with a network probe against the running app. After the opening consult, the
only request the app ever sends to `/api/consult` is that first one:

```
after initial consult, api calls: [ 'new' ]
after clicking "New take":  api calls = [ 'new' ]  url changed: false  replies on page: 1
after sending a push back:  api calls = [ 'new' ]                      replies on page: 1
after "Ask Mike":           api calls = [ 'new' ]                      replies on page: 1
```

A user types a follow-up, presses send, and their text disappears with no reply, no
error and no change on screen.

The cause is not a bug in those handlers. It is a missing screen.
`docs/design/screens.md` section 12 specifies screen F17, the case thread, as the
place every follow-up lands: user turns as right-aligned bubbles, persona turns as
compact tinted line cards, "Asked Mike" dividers, "Take 2" markers, skeleton turns
while a reply arrives, a failed reply card with Retry. That is design review 01's
finding B9, which design review 02 recorded as resolved on 2026-10-25. The design is
approved. The route does not exist. `ResultView`'s own doc comment says as much: "the
first reply of a case. Everything after it goes to the thread."

Two more rules from the same section are therefore also untrue today: opening a case
from the cases list should open the thread, not the result; and back from the thread
should go Home.

The good news is that the server side is finished. Posting `action: "followup"` to
`/api/consult` creates the consult correctly and the case then holds two replies,
confirmed directly against the API. The engine, the schema, the thread rebuild in
`buildThread`, the persona switch and the another-take prompts are all there and all
working. What is missing is the screen that calls them.

**Not built tonight, deliberately.** F17 is a specified, approved screen with its own
layout, five states and routing rules, not a defect to patch. Improvising it
unattended at six in the morning, outside the design to build to review loop your
process defines, would have produced something that looked finished and was not. The
four e2e tests for it are written and sitting in `tests/e2e/thread.spec.ts` marked
`fixme`, so they turn green the day the screen lands rather than needing to be
rediscovered.

This is the largest single piece of work left before anyone else uses this. I would
put it ahead of P1-A: a user who cannot sign in still gets the product's core moment;
a user whose follow-up vanishes concludes the app is broken.

---

## P0-A diagnosis: the failed deployment

`dpl_3VuVnWAYTnTgyGSxUEocfSutGs72`, commit b6a493e, failed at the build step with:

```
ENOENT: no such file or directory, lstat
'/vercel/path0/.next/server/app/(app)/page_client-reference-manifest.js'
```

It was not transient, not an env var difference and not a stale cache. That commit
added a root `app/page.tsx` whose body was an unconditional `redirect("/welcome")`.
The app already had `app/(app)/page.tsx`, and a route group maps to the same path, so
two files resolved to `/`. Next emitted the client reference manifest under one name
and Vercel's build trace looked for it under the other.

It is already fixed on main, by 1ecf28d, which removed the root file. That commit's
message records a second symptom worth keeping in mind: because the root page took no
dynamic input, Next statically prerendered it, baking a permanent 307 to `/welcome`
into the build output. Every request to `/` got that frozen redirect regardless of
session, which is why guest sign-in looked like it was looping even though Supabase
was creating the user correctly.

Twelve production deploys since then are READY, including main's current head. No
action needed, and nothing to redeploy.

---

## Defects found by running the app

These are new. None appears in review 01 or review 02, and all were live in
production. Numbering matches docs/qa/qa-report-02.md section 11, where the missing
thread screen is D4; here it is P0-B, above.

### D1: the cases and saved lists crashed as soon as they had anything in them

Both screens are server components and both imported `relTime` from
`components/ui.tsx`, a `"use client"` module. Next treated that as calling a client
function from the server and threw during render. Any user with one case opened the
cases tab and got "Application error: a server-side exception has occurred". The saved
list did the same on the first saved line.

The empty states worked perfectly, which is the whole reason this survived. Source
review sees an import that resolves. The build compiles. The typechecker is happy. It
only fails with data in it, and until tonight nothing in the process ever put data in
it.

Fixed by extracting `relTime` to a plain module. Two e2e tests now fail if it comes
back.

I would treat this as the strongest argument in the report for keeping the e2e gate
honest rather than skipping it when it is inconvenient. Two screens out of six, broken
for exactly the users who had come back a second time.

### D2: five CSS tokens used on four screens were never defined

`--border`, `--fg-1`, `--fg-3`, `--fg-4` and `--surface-raised` are referenced on
welcome, cases, saved and settings. None of them exist in `globals.css`, and none of
the usages had a fallback.

An undefined custom property in a shorthand does not fall back to a sensible default,
it unsets the whole declaration. So the row dividers on three screens were simply
absent, and the unselected persona cards on the welcome screen had no border at all.
The colour cases were subtler and in some ways worse: every piece of secondary text
using `--fg-3` inherited the full foreground colour, so timestamps, captions and the
legal small print rendered at the same visual weight as the content above them. The
hierarchy the design system specifies was flattened on four screens.

Mapped onto the tokens that exist rather than adding synonyms.

### D3: the primary button on the welcome screen had no styling

Three places used `className="cta"`. There is no `.cta` rule anywhere in the
stylesheet. On the first screen of the app, "Try it free", the single action the whole
onboarding funnel depends on, measured 320 by 23 pixels and rendered as plain
centred text. It read as a caption. Compare `docs/qa/shots-02/01-welcome.png` with the
same screen on main.

For a product whose entire guest funnel is welcome then consult, this is the most
commercially expensive of the three. All three usages now use `.btn.primary`, which
the design system already defines.

The settings one also pointed at `/sign-up`, which does not exist in the app router,
so a guest tapping "create an account" landed on the 404.

### D5: the tab bar floated in the middle of the cases, saved and settings screens

`.screen-main`, the class those three screens wrap their content in, is not defined
anywhere either. The region never grew, so the tab bar sat directly under the content
instead of at the bottom of the phone: on the saved tab's empty state, roughly 590
pixels up, with nothing below it. Compare the before and after of
`shots-02/05-cases.png` if you want to see how obvious it is once you look.

The cases list also printed the spoken line raw, pause bars and all: "You think they're
holding all the cards. || They're holding a bluff." The marks are a speech instruction,
not punctuation, and screens.md section 11 already says the excerpt is stripped.

Three defects now, D2, D3 and D5, all of the same kind: a class or token that is
referenced but never defined, failing silently rather than loudly. Worth a lint rule
eventually. For now the audit spec catches the visible consequences.

---

## User journey walkthrough

Walked on the preview build at 390 by 844, against `docs/qa/shots-02/`.

| Journey step | Status | Notes |
|---|---|---|
| Land on `/` unauthenticated | READY | Redirects to `/welcome`. The root 404 and the frozen redirect are both gone |
| Welcome, persona choice, age and AI disclosure | READY | Now with a real primary button and visible card borders. First screen has no `h1`, see A1 below |
| Guest: submit situation (text) | READY | Composer, starters, persona rail, intensity all working |
| Guest: voice input | READY where supported | Mic renders only when dictation is available; absent, not inert, when it is not |
| Guest: see reply | READY | Line, read, play, avoid, billed hours, pause marks rendering as designed |
| Guest: keep case upsell | READY | Unchanged |
| Sign in (magic link, Google) | BLOCKED | P1-A. The form works; the callback has nowhere valid to return to |
| Signed in: case thread | **MISSING** | P0-B. The screen does not exist; follow-ups, another take and persona switch are all inert |
| Signed in: cases list | FIXED | Was a server error with any content. Now renders, with the tab bar in the right place and the excerpt free of pause marks |
| Signed in: saved lines | FIXED | Same |
| Settings | FIXED | Guest upsell no longer links to a 404 |
| PWA install and offline | READY | `/offline` precached and served as the navigation fallback |
| Care mode (crisis) | READY | Persona fully dropped, helpline reachable, no pause marks. Now covered by both a unit test and an e2e test |
| Meta and clarify modes | READY | A greeting or "what can you do" no longer produces a three move plan and billed hours |
| Rate limiting and guest quota | READY | Unchanged |

---

## Quality gates

| Gate | Result |
|---|---|
| Build | PASS |
| Typecheck | PASS |
| Lint | PASS, 8 pre-existing warnings, 0 errors |
| Unit tests | PASS, 95 of 95 (was 75) |
| E2e, mock mode | PASS, 22 of 22 run, 4 skipped against P0-B (was: no config, gate skipped) |
| Persona harness, contract layer | PASS, 181 of 181, safety 24 of 24 (was 0 of 181) |
| Copy and naming sweep | PASS, zero em or en dashes in code, docs, copy or commit messages |
| Accessibility hard gates | PASS |
| Phone width 390 | PASS, zero overflow on ten screens |
| Screenshots | DONE, ten screens |
| Harness release gates (rubric section 4) | **NOT RUN**, needs a live model and a Gemini key |

---

## Findings

### P0, blocks everything

**P0-B: the case thread screen (F17) was never built.** Full detail above. Every
follow-up control on the result screen is inert. Dev work, specified and approved, not
started.

### P1, blocks real users, founder only

**P1-A: Supabase Auth redirect URLs are still not configured.**
Unchanged from review 02 and unchanged by this branch. Magic link and Google OAuth
return to `http://localhost:3000/auth/callback`, so every real sign-in fails silently.
The guest flow works without it, which is enough for your own testing but not enough
to send the link to anyone who will want their cases to persist.

### P2, before public launch

**P2-G: the rubric's release gates have never been run.**
`npm run harness:mock` now passes 181 of 181, but that is the contract layer only:
JSON shape, lengths, pause marks, modes, dashes. The gates in `harness/rubric.md`
section 4, the ones that actually speak to whether Harvey sounds like Harvey, need
`npm run harness -- --judge` against the live model with a Gemini key: safety 100
percent per persona, 90 percent elsewhere, D1 voice fidelity mean at least 4.2, and
distinct angles across the three personas in at least 85 percent of cases, each case
run three times.

This is the single biggest remaining unknown about the product. Everything tonight
proves the machine works. None of it proves the advice is good, and the advice is the
product.

**P2-H: no real device has run this.**
Headless Chromium at one viewport is not an iPhone. The safe area insets, the PWA
install flow, the Android voice list fix from 67551cd and the iOS speechSynthesis
behaviour all need a real phone before anyone else sees this.

**P2-I: the Suits pack is still the active persona pack.**
`lib/personas/config.ts` is explicit that the Suits-named pack is "private beta,
unpaid preview only; a paid launch needs a licence", and the result screen carries the
unofficial fan project disclaimer. The original pack exists behind
`NEXT_PUBLIC_PERSONA_PACK=original`, with placeholder names chosen by engineering
(Cole Mercer, Theo Lark, Vivian Hale) explicitly waiting on you. Not a blocker for
private testing. It is a blocker for charging anyone, and the names are a founder
decision that nobody else should make.

### N, nice to have

**N6: no `h1` on the welcome screen.** The wordmark is an accessible SVG, not a
heading, so the first screen offers a screen reader user no landmark. One line to fix.

**N7: tap targets under 44 by 44.** Sixteen on the result screen (icon buttons at 36,
chips at 32 high, soft buttons at 38), four on home, one each on welcome, sign-in and
care. Not a WCAG AA failure, but on a phone first product aimed at people using it one
handed on a commute it is worth a deliberate design decision rather than an accident.

**N10: the composer can lose text typed before hydration.** Surfaced while making the
e2e suite stable. Text entered before React hydrates is wiped by the component's empty
state and the send button stays disabled. The home screen autofocuses the composer, so
on a slow phone this is a plausible first interaction with the product: they type,
nothing happens, they try again. Small fix, real impression.

**N8: eight lint warnings** on underscore prefixed unused parameters. The eslint
config does not exempt the underscore convention the code is using. One config line.

**N9: `GUEST_HASH_SALT`, `ANTHROPIC_MODEL`, `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`.**
Carried over from review 02 N1 and N2, all yours, all in the Vercel dashboard.

---

## What needs you

Four things, in order of how much they block:

0. **A decision on P0-B.** The thread screen is specified and approved and is the
   next build. It is dev work, not yours, but it is big enough that you should decide
   whether it goes ahead as specified in screens.md section 12 or whether you want to
   simplify it first. Nothing else on the roadmap matters as much.
1. **Supabase Auth redirect URLs** (P1-A). Dashboard, Authentication, URL
   Configuration. Site URL and additional redirect URLs set to the production domain
   plus `/auth/callback`. Until this is done, nobody can sign in, so nobody's cases
   survive a cleared cookie.
2. **Vercel env vars** (N9). Set `GUEST_HASH_SALT` to a random string; delete
   `ANTHROPIC_MODEL`, `ANTHROPIC_API_KEY` and `ELEVENLABS_API_KEY`, none of which are
   read any more.
3. **A live harness run with a judge** (P2-G), and a decision on the persona pack
   (P2-I). The first tells you whether the product is good. The second decides whether
   you can sell it.

---

## Verdict

**BLOCKED** for public sharing, on P0-B (the thread screen does not exist, so every
follow-up is dead), P1-A (no real sign-in) and P2-G (no evidence about advice
quality).

**Good for your own testing of the first reply loop** on
`fix/release-review-02-backlog`. The branch is green on every gate PROCESS.md defines,
including the two that had never run, and it fixes three production defects that
source review could not have found. Welcome, consult, result, care, cases, saved,
settings, offline and 404 all work. Stop at the first reply; anything past it is
P0-B.

Not merged and not deployed to production, per the standing instruction. The branch is
pushed with a READY Vercel preview; the merge is yours.

Recommended next: open the preview on your phone, walk welcome to result to cases, and
confirm D3 reads the way it should now. Then decide on P0-B, which is the next build
either way. Then P1-A, then the live harness run.

---

*Reviewed against the running preview build and the ten screenshots in
docs/qa/shots-02, not source code alone. Deployment state verified through the Vercel
API. Every claim about a gate in this document corresponds to a command in
docs/qa/qa-report-02.md that can be re-run.*
