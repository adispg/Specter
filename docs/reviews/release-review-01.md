# Release Review 01 — Specter App

**Date:** 2026-10-25  
**Reviewer:** PM Agent (automated source-code review)  
**Branch:** dev  
**Verdict:** BLOCKED

---

## Why BLOCKED

The app has a complete API backend and a full component library, but **zero page.tsx files exist** in the App Router. The `.next/server/app-paths-manifest.json` confirms only API routes were compiled. No UI is served at any route: `/`, `/welcome`, `/cases`, `/cases/[id]`, `/saved`, `/settings` all return 404. The mockup HTML prototype exists as a design reference (`docs/design/mockups.html`) but has not been translated into Next.js pages. This is the release blocker.

---

## User Journey Results

| Journey step | Status | Notes |
|---|---|---|
| Land on `/` | BLOCKED | No page.tsx — 404 |
| Welcome / age gate | BLOCKED | No `/welcome/page.tsx` |
| Guest: describe situation (voice or text) | BLOCKED | Composer exists in `ui.tsx` but no page renders it |
| Guest: see reply (line + advice cards) | BLOCKED | `ResultView` exists but no page mounts it |
| Guest: "Keep this case?" upsell | PARTIAL | `KeepCaseSheet` exists and is wired in `AppProvider` |
| Sign in (Google / magic link) | PARTIAL | `SignInForm` complete; auth callback route exists at `/auth/callback` |
| Signed-in: case thread | BLOCKED | No `/cases/[id]/page.tsx` |
| Signed-in: cases list | BLOCKED | No `/cases/page.tsx` |
| Signed-in: saved lines | BLOCKED | No `/saved/page.tsx` |
| Settings / intensity control | BLOCKED | `IntensityControl` sheet exists in `ui.tsx` but no settings page |
| Install as PWA | PARTIAL | `manifest.ts` and service worker wiring exist in root layout |
| TTS playback | READY | `LineCard`, `usePerformance`, ElevenLabs route all wired |
| Voice input | READY | `VoiceMode` component and `/api/stt` route wired |
| Care mode (crisis) | READY | `CareView` and safety rules in personas config |
| MOCK_AI=1 dev mode | READY | Mock auth route and env flag work |

---

## Findings

### B — Blockers (must fix before any review can proceed)

**B1 — No page.tsx files (critical)**  
The entire `app/(app)/` directory contains only `layout.tsx`. No page is rendered at any user-facing route. All components (`ResultView`, `LineCard`, `AdviceCards`, `Composer`, `AppProvider`, `AppFrame`, `PersonaRail`, `TabBar`, etc.) are implemented and ready, but nothing wires them into the router. 

Routes that need a page.tsx:
- `app/(app)/page.tsx` — home / composer screen (new case entry)
- `app/(app)/welcome/page.tsx` — age gate + disclosure ack + sign-in
- `app/(app)/cases/page.tsx` — cases list
- `app/(app)/cases/[id]/page.tsx` — case thread (consult result + follow-ups)
- `app/(app)/saved/page.tsx` — saved lines
- `app/(app)/settings/page.tsx` — settings (intensity, persona, voice prefs)

**B2 — No data-fetching layer for pages**  
Server components for the above routes need to call Supabase directly (via the server client) to load `cases`, `consults`, `saved_lines`, and `feedback` rows before handing them to the client components. The API routes (`/api/cases/all`, `/api/cases/[id]`, `/api/saved`) exist and can be used as a fallback but page-level server fetching is cleaner and faster.

**B3 — `(app)/layout.tsx` redirects but has no destination**  
The layout checks `age_confirmed_at` / `disclosure_ack_at` and redirects to `/welcome?step=2`. The `/welcome` page does not exist, so this redirect always 404s. The check is correct; the destination page is missing.

---

### N — Polish / Nice-to-Have (post-unblock)

**N1 — No loading.tsx / error.tsx**  
App Router supports `loading.tsx` (streaming skeleton) and `error.tsx` (error boundary) per segment. None exist. The skeleton assets (persona tints, avatar placeholder) are all defined in the design system and ready to use.

**N2 — TabBar shows on result screen (mobile UX)**  
`TabBar` is defined in `ui.tsx` with three tabs (Consult, Cases, Saved). On the result screen, `ResultView` shows a `Composer` at the bottom plus a tab bar. On mobile this stacks two bottom navs. Design should decide whether the tab bar is hidden during active result view.

**N3 — No `not-found.tsx`**  
Navigating to an unknown route shows Next.js default 404. A branded not-found page is missing.

**N4 — `PersonaRail` tab order**  
Current order in `ui.tsx`: closer, prodigy, insider. On mobile the rail is horizontal. When the active persona is "insider" (rightmost), tapping "closer" requires crossing the full width. Consider whether the active persona should be centered or reordered.

**N5 — `VoiceMode` close behavior**  
`VoiceMode` calls `router.push('/cases/${caseId}')` on finish, which requires the cases thread page to exist (B1). This is a dependency, not a separate bug.

**N6 — `AppProvider` guest usage count**  
`openKeepCase(forced)` is triggered from `ResultView` using `sessionStorage` to detect second consult attempts. `sessionStorage` is cleared on tab close. A user who closes and reopens the tab gets another free consult. This is acceptable for beta but should be tracked via `guest_usage` table for production.

**N7 — No offline page**  
`OfflineBanner` shows an inline banner when offline. If the user navigates while offline, no graceful page is shown. The PWA manifest is set up but no `fallback` route is defined.

**N8 — Intensity label "No mercy" in UI**  
Stored as `"nomercy"` in DB (correct). Displayed as "No mercy" in `IntensityControl`. Confirm this is the intended display label for all packs (suits and original).

---

## Next Tasks for UI Dev Agent

Priority order. Items marked (server) need Supabase server-side data fetching. Items marked (client) are pure component assembly.

1. **Create `app/(app)/welcome/page.tsx`** (server + client)  
   - Step 1: age confirmation checkbox + accept  
   - Step 2: disclosure acknowledgment  
   - Step 3: sign-in (reuse `SignInForm`)  
   - On completion: set `age_confirmed_at` + `disclosure_ack_at` via `/api/profile`, redirect to `/`  
   - Must handle `?step=2` query param (layout already generates this redirect)

2. **Create `app/(app)/page.tsx`** (server + client)  
   - Serve the home / new-case screen  
   - Mount `AppFrame` > `PersonaRail` + `Composer` + `TabBar`  
   - Load quick situations from `QUICK_SITUATIONS` (config, no DB call needed)  
   - On submit: POST to `/api/consult` with `{action:"new", persona, intensity, situation}`, then redirect to `/cases/[caseId]`

3. **Create `app/(app)/cases/[id]/page.tsx`** (server)  
   - Fetch `cases` row + all `consults` for case + `saved_ids` for user + `feedback` map  
   - Pass to `ResultView` for first consult; render thread (follow-up consults) below  
   - Handle `setPending` / `pending` cookie: if a pending consult request exists in cookies, fire it server-side or via a client effect on mount  

4. **Create `app/(app)/cases/page.tsx`** (server)  
   - Fetch all cases for user (via Supabase server client, ordered by `updated_at` desc)  
   - Render list with `TabBar`; each row links to `/cases/[id]`  
   - Empty state: "No cases yet. Bring a situation."

5. **Create `app/(app)/saved/page.tsx`** (server)  
   - Fetch `saved_lines` joined with `consults` for user  
   - Render `LineCard` in read-only mode per saved line  
   - Empty state: "Nothing saved yet. Tap the bookmark on any line."

6. **Create `app/(app)/settings/page.tsx`** (client)  
   - Intensity control (reuse `IntensityControl` sheet trigger)  
   - Voice settings (speak on / off, pace slider)  
   - Sign-out button  
   - Account deletion link (calls `/api/account` DELETE)

7. **Add `loading.tsx` per segment** (client)  
   - Skeleton using persona tint vars; avatar placeholder; no spinner (per design system)

8. **Add `not-found.tsx`** (client)  
   - Branded 404 with "Back to home" link

---

## Next Tasks for Design Agent

1. **Home screen comp** — the new-case entry screen. Quick situations row, persona rail, composer. Reference: `mockups.html` section "Home". Confirm quick situation chip layout at 320px viewport (smallest target device).

2. **Cases list comp** — card per case: title, persona chip, date, line preview. Confirm empty state copy and illustration (if any).

3. **Welcome / onboarding flow** — 3-step flow (age, disclosure, sign-in). Step indicator style. Confirm copy for each step's legal disclaimer (age gate text, disclosure text).

4. **TabBar active state** — current design shows three tabs. Confirm active tab indicator style (underline, filled chip, color shift). Confirm icon set for Consult / Cases / Saved.

5. **Loading skeleton** — per-screen skeleton frames for result view, cases list, saved lines. Should use persona tint as base color with shimmer layer.

6. **Settings screen comp** — intensity picker (Measured / Sharp / No mercy), voice toggle, pace slider, account section. Confirm layout for each control.

7. **Not-found page** — branded 404. Short copy. One CTA.

---

## What Is Already Solid (Do Not Rebuild)

- All API routes: consult, cases, saved, feedback, profile, account, tts, stt, auth — complete
- Persona config, bibles, voice IDs, theme vars — complete  
- `AppProvider`, `AppFrame` — context and theming wired  
- `ResultView`, `LineCard`, `AdviceCards`, `Composer`, `VoiceMode` — complete  
- `SignInForm`, `KeepCaseSheet` — complete  
- `PersonaRail`, `TabBar`, `IntensityControl` — complete in `ui.tsx`  
- Zod schemas, reply normalization, consult pipeline — complete  
- 70 Vitest tests passing  
- MOCK_AI=1 dev mode — working  
- ElevenLabs TTS + Web Speech fallback — wired  
- PWA manifest and service worker — wired  
- Supabase RLS, 9 tables — schema ready (pending supabase-remaining.sql confirmation)

---

*Review conducted via source-code analysis. Browser navigation to localhost was not available in this review environment. All findings are based on reading compiled manifests, component source, API routes, and config files.*
