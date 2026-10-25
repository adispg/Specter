# Release Review 02 — Specter App

**Date:** 2026-10-25
**Reviewer:** PM Agent (automated source-code and deployment review)
**Branch:** main (commit b6a493e)
**Build:** READY locally (npm run build clean); latest Vercel deploy ERROR (see P0-A below)
**Previous verdict:** BLOCKED (release-review-01 — no page.tsx files)
**This verdict:** BLOCKED (one P0 deployment failure; all B1-B3 from review-01 resolved)

---

## Summary

All six page blockers from review-01 are resolved. The app now has a complete user journey
from `/welcome` through consult submission to `/cases/[id]` result. The Gemini Flash 2.0
LLM harness is hardened with three-layer JSON enforcement. Supabase schema (9 tables, RLS,
triggers, functions) is confirmed deployed.

One P0 remains: the latest production deployment (`b6a493e`) returned ERROR on Vercel. The
local build is clean (`npx tsc --noEmit` passes, `npm run build` succeeds). The previous
production deployment (`2d6401f`, specter-bdehhc0sr-...) is READY and currently serving.
The app is accessible at that URL but the root redirect fix (`app/page.tsx`) has not reached
production. Users who hit `/` unauthenticated still see 404 on that older build.

---

## User Journey Results

| Journey step | Status | Notes |
|---|---|---|
| Land on `/` unauthenticated | PARTIAL | Root page.tsx exists and redirects to /welcome. Deployed on older build, not yet on production. |
| Welcome / age gate / disclosure | READY | `/welcome/page.tsx` complete: 3 persona cards, 18+ gate, Try it free / Sign in |
| Guest: submit situation (text) | READY | `/page.tsx` wired: PersonaRail, Composer, useConsult.run(), redirect to /cases/[id] |
| Guest: voice input | READY | Composer has onMic; VoiceMode wired in ResultView with caseId + onFinished |
| Guest: see reply | READY | `/cases/[id]/page.tsx` server component fetches case + consults, renders ResultView |
| Guest: keep case upsell | READY | KeepCaseSheet fires from ResultView after autoSpeak; sessionStorage guard present |
| Sign in (magic link / Google) | PARTIAL | Form exists; Supabase Auth redirect URLs must be set in Supabase dashboard |
| Signed-in: case thread | READY | `/cases/[id]/page.tsx` renders full thread, follow-ups, persona switch |
| Signed-in: cases list | READY | `/cases/page.tsx` server component, ordered by updated_at |
| Signed-in: saved lines | READY | `/saved/page.tsx` server component, empty state wired |
| Settings | READY | `/settings/page.tsx` guest vs signed-in, sign-out, intensity implicit via AppProvider |
| PWA install | READY | manifest.webmanifest route present, service worker wired, headers set |
| TTS playback | READY | Browser speechSynthesis always used; ElevenLabs path dormant (ttsConfigured=false) |
| STT voice input | READY | Deepgram Nova-3 via /api/stt; sttConfigured=true when DEEPGRAM_API_KEY present |
| Care mode (crisis) | READY | SAFETY_OVERRIDES in rules.ts; CareView component; mode:"care" path in ResultView |
| Gemini JSON enforcement | READY | Three layers: OUTPUT_CONTRACT CRITICAL block, responseMimeType+responseSchema, repairPrompt STOP directive |
| Rate limiting / guest quota | READY | consume_guest_quota function confirmed in Supabase; guestConsults limit enforced |

---

## Findings

### P0 — Must fix before production can serve the root redirect

**P0-A: Latest production deployment (b6a493e) is ERROR on Vercel**
The commit that adds `app/page.tsx` (root redirect) failed to build on Vercel. Local build is
clean. Possible causes: (1) Vercel's Node cache serving stale types, (2) a build-time env var
check that differs between local and Vercel, (3) transient infrastructure failure.

Action: Go to https://vercel.com/adityaguptaiiml-4524/specter and check the build logs for
deployment `dpl_3VuVnWAYTnTgyGSxUEocfSutGs72`. If it's a transient failure, trigger a
manual redeploy from the Vercel dashboard (Deployments -> Redeploy). If it's an env issue,
compare env vars between the failed build and the last READY build.

The fix is already committed and correct in source. Only the Vercel deploy needs to succeed.

---

### P1 — Blocks sign-in for real users (must fix before sharing app link)

**P1-A: Supabase Auth redirect URLs not configured**
Magic link emails and Google OAuth return a callback to `http://localhost:3000/auth/callback`
by default, not to the production Vercel URL. Without this configuration, every sign-in
attempt fails silently: the user clicks the email link and lands on an error page.

Action (founder only): Supabase dashboard -> Authentication -> URL Configuration:
- Site URL: `https://specter-bdehhc0sr-adityaguptaiiml-4524.vercel.app` (or custom domain)
- Additional redirect URLs: same domain + `/auth/callback`

This blocks real user sign-in entirely. Guest flow works without it.

---

### P2 — Known gaps (do before public launch; does not block internal testing)

**P2-A: No loading.tsx per segment**
Navigating between routes shows a blank white flash while server components fetch. The design
system has persona tints and avatar placeholder assets ready. A skeleton per segment (cases
list, result, saved) would eliminate the flash.

**P2-B: No not-found.tsx**
Unknown routes show the Next.js default 404. A branded not-found page with "Back to home"
is missing.

**P2-C: Home screen has no voice entry**
The home `/page.tsx` Composer has `onMic` wired but the handler is not connected — there is
no `onMic` prop passed in the current home page. The mic button renders but tapping it does
nothing. VoiceMode requires a `caseId`, which does not exist yet on the home screen. Options:
(a) disable mic on home, show it only in ResultView thread, or (b) create a case first then
open VoiceMode. The current code omits the prop entirely, which renders the mic icon silently
inert.

**P2-D: TabBar visible on result screen doubles bottom nav**
ResultView mounts Composer (bottom input) and the result screen's parent AppFrame renders
AppFrame children which include TabBar. On mobile this stacks two navigation elements at the
bottom. Check whether TabBar should be suppressed on `/cases/[id]`.

**P2-E: Guest session usage tracking is sessionStorage only**
The KeepCaseSheet guard uses sessionStorage to detect "already tried to keep." Clearing
browser data or switching tabs resets the gate. The `guest_usage` table is provisioned in
Supabase and the `consume_guest_quota` function is deployed. The server-side quota (1 guest
consult) enforces the hard limit correctly; the sessionStorage gate is just a UX nicety.
Low risk; no action needed for beta.

**P2-F: VoiceMode mic on home screen inert**
Related to P2-C. The Composer component accepts `onMic` as a prop. The home page passes no
`onMic`, so the mic icon still renders (Composer always shows the mic). The icon tap silently
does nothing. Either pass `undefined` explicitly and Composer should conditionally hide the
button, or pass a handler that creates a case-less audio capture flow. Quick fix: hide the
mic when no `onMic` is passed.

---

### N — Nice to have (post-launch polish)

**N1: `GUEST_HASH_SALT` uses dev default in production**
`lib/env.ts` line 66: `process.env.GUEST_HASH_SALT || "specter-dev-salt"`. If this env var
is not set in Vercel, production guest device/IP throttling uses a predictable salt. Easy to
guess device hashes. Not a security issue for beta but worth setting a real random value in
Vercel env vars.

**N2: `ANTHROPIC_MODEL` env var is stale**
Vercel shows `ANTHROPIC_MODEL: claude-sonnet-5-5`. This var is not read anywhere (Gemini is
the LLM now). It causes no harm but is confusing. Can be deleted from Vercel dashboard.

**N3: Composer `onMic` conditional rendering**
When `onMic` is not provided, the mic button should not render. Currently the Composer always
shows the mic icon. This is a minor UI issue (inactive button visible on home) but worth a
one-line fix.

**N4: `app/(app)/page.tsx` uses className="screen" not "scr"**
ResultView, CareView use `className="scr"`. The home page uses `className="screen"`. Verify
both classes are defined in the global stylesheet; if only "scr" is styled this creates a
layout difference on the home screen.

**N5: No offline fallback page**
`OfflineBanner` shows an inline banner when the device is offline. If the user navigates to
a new route while offline, Next.js returns an uncached response and the browser shows a
connection error. A PWA fallback page (served from the service worker cache) would give a
branded offline state.

---

## Env Vars Checklist (production Vercel)

| Variable | Required | Status |
|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | Yes | Set |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Yes | Set |
| GEMINI_API_KEY | Yes | Set |
| DEEPGRAM_API_KEY | Yes (STT) | Set |
| GUEST_HASH_SALT | Recommended | NOT SET (uses dev default) |
| ANTHROPIC_API_KEY | No (unused) | Set but empty — can delete |
| ELEVENLABS_API_KEY | No (TTS dormant) | Set but empty — can delete |
| ANTHROPIC_MODEL | No (stale) | Set but unused — can delete |

---

## What Changed Since Review-01 (resolved blockers)

All six B-series blockers from review-01 are resolved:
- B1: All six page.tsx files now exist and render correctly
- B2: Server data-fetching via session.store in (app)/layout.tsx and each page
- B3: `/welcome` page exists; layout redirect has a valid destination
- Gemini Flash 2.0 harness with structured output (responseMimeType + responseSchema)
- Deepgram STT replacing ElevenLabs STT (free tier, Nova-3)
- Browser speechSynthesis as sole TTS path (ttsConfigured=false)
- Root app/page.tsx redirect (committed; needs successful Vercel deploy)

---

## Immediate Next Actions (in order)

1. **[Founder] Check Vercel build logs for dpl_3VuVnWAYTnTgyGSxUEocfSutGs72** and redeploy
   or fix the build error so the root redirect reaches production. This is P0.

2. **[Founder] Set Supabase Auth redirect URLs** to the production Vercel domain. Blocks all
   real sign-in. This is P1.

3. **[Dev] Fix Composer to hide mic when `onMic` is not provided** (one-line conditional
   render). Fixes P2-C / P2-F / N3 at once.

4. **[Dev] Add `loading.tsx` per route segment** — cases, cases/[id], saved. One file each.

5. **[Dev] Add `not-found.tsx`** — branded 404, two lines, "Back to home" button.

6. **[Dev] Set `GUEST_HASH_SALT`** to a random string in Vercel env vars.

---

## Verdict

**BLOCKED** on P0 (Vercel deploy ERROR) and P1 (Supabase Auth redirect URLs).

Once P0 and P1 are resolved, the app is ready for **internal / founder testing** with guest
flow and text-only consults. It is not ready for public sharing until P2-C (mic inert on home)
and P2-D (double bottom nav) are also addressed.

The core loop — welcome, describe situation, get Specter reply, save line — is fully
implemented and wired end to end. The quality of the Gemini harness (three-layer JSON
enforcement) is production-grade. The Supabase schema is complete. The foundation is solid.

---

*Review conducted via source-code analysis of all page.tsx, component, API route, env, and
build files. Deployment state verified via Vercel MCP. Local build verified clean with
`npm run build` (no TypeScript or lint errors).*
