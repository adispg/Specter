# QA Report 02

Date: 2026-10-26
Branch: `fix/release-review-02-backlog`
Base: `main` at a407324
Tester: QA agent (automated, unattended overnight run)
Mode: everything below runs offline in mock mode. No Gemini key, no Deepgram key,
no Supabase project. `MOCK_AI=1` serves the fixtures in `lib/consult/mock.ts` and,
with no Supabase env vars present, `MOCK_AUTH` provides sessions.

## Summary

| Check | Result |
|-------|--------|
| 1. Build (`npm run build`) | PASS |
| 2. Typecheck (`npx tsc --noEmit`) | PASS |
| 3. Lint (`npx next lint`) | PASS with 8 warnings, 0 errors |
| 4. Unit tests (`npm test`) | PASS, 95 of 95 |
| 5. E2e, mock mode (`npx playwright test`) | PASS, 20 of 20, 4 skipped (see D4) |
| 6. Persona harness (`npm run harness:mock`) | PASS, 181 of 181, safety 24 of 24 |
| 7. Copy and naming sweep | PASS |
| 8. Accessibility | PASS on the four hard gates, 2 advisories |
| 9. Phone width, 390 by 844 | PASS, zero horizontal overflow on all 10 screens |
| 10. Screenshots | DONE, `docs/qa/shots-02/` |

Overall: **PASS**

Four defects were found during this gate. Three were fixed on the branch: the cases
and saved lists threw a server exception as soon as they held any data, five CSS
tokens used across four screens were never defined, and the primary button on the
welcome screen had no styling at all. The fourth, D4, is a missing screen rather than
a bug, so it is reported rather than fixed: every follow-up action on the result
screen is inert because the case thread it is supposed to navigate to was never
built. Details in section 11.

---

## Details

### 1. Build

`npm run build`. Next.js 15.5.28. 25 routes compiled: 14 dynamic API routes, 2 auth
routes, 4 static, the rest server rendered on demand. No errors, no warnings.

Verdict: **PASS**

### 2. Typecheck

`npx tsc --noEmit`. No output, zero errors. Run after every change on the branch,
not only at the end.

Verdict: **PASS**

### 3. Lint

`npx next lint`. Zero errors. Eight warnings, all `@typescript-eslint/no-unused-vars`
on deliberately underscore prefixed parameters in `lib/api.ts`, `lib/consult/gemini.ts`
and `lib/data/memory.ts`. Pre-existing, not introduced on this branch, and harmless;
the project's eslint config does not yet exempt the underscore prefix.

Verdict: **PASS** (warnings noted, no action required for this release)

### 4. Unit tests

`npm test`. 95 tests across 6 files, up from 75 on main.

```
tests/unit/schema.test.ts    33 tests
tests/unit/ratelimit.test.ts 12 tests
tests/unit/safety.test.ts    12 tests   (new)
tests/unit/spoken.test.ts    20 tests
tests/unit/text.test.ts      14 tests
tests/unit/reltime.test.ts    4 tests   (new)
```

New cover added on this branch:

- `safety.test.ts`: crisis and abuse detection, the ordinary hard situation that must
  not trip it ("I am going to kill this presentation tomorrow" stays persona mode),
  minor detection, and every canned care reply put through both the reply schema and
  the harness's own deterministic checks. The safety pre-screen is the one path that
  never calls the model, so its copy is now held to the same contract as generated
  copy.
- `reltime.test.ts`: the relative timestamp helper extracted in the cases list fix.
- Four new tests in `schema.test.ts` covering the mock client's care, meta, identity
  and clarify routes.

Verdict: **PASS**

### 5. E2e, mock mode

`npx playwright test`. 18 tests, 1 worker, Chromium at 390 by 844.

`playwright.config.ts` did not exist before this branch, which is why gate 4 of
PROCESS.md was recorded as SKIP in qa-report-01. It now exists, builds the app and
starts it on port 3100 with mock mode and raised guest quotas (every test is a fresh
guest, but they share one IP, and the production default of five guest consults per
IP per day would have failed tests part way through for the wrong reason).

Coverage:

| Spec | Covers |
|---|---|
| `journey.spec.ts` | cold visit redirects to `/welcome`; persona choice; guest onboarding; a consult producing a case; starters filling the composer without sending; the mic conditional from both sides; no stacked bottom nav on the result screen; tab bar to cases and saved; a saved line reaching the saved list; the 404; the offline page; manifest and service worker |
| `modes.spec.ts` | one test per reply mode: crisis to care with a reachable helpline and no persona language, a capability question answered without a plan, a thin situation asking for the missing facts, an out of bounds request declined with a lawful route |
| `thread.spec.ts` | the second visit: saving and feedback surviving a reload, deleting a case. Four more tests are written and marked `fixme` against the missing thread screen, see D4 |
| `audit.spec.ts` | phone width, accessibility and screenshots, see sections 8 to 10 |

Verdict: **PASS**, 20 of 20 run, 4 skipped.

The four skips are `test.fixme` in `thread.spec.ts`, written against the case thread
screen that does not exist (D4). They are deliberately left in the suite rather than
deleted: they are correct tests of specified behaviour, and they should be un-skipped,
not rewritten, when the screen lands.

### 6. Persona harness

`npm run harness:mock`. 181 rows, 63 situations across three personas.

On main this reported **0 of 181 passing**, which is not a gate, it is noise. Three
causes, all fixed on this branch:

1. The `marks spaced` check required whitespace on both sides of every `|`, but a long
   pause is the two character token `||`, so the second bar always read as a mark
   jammed against a non space character. No reply containing a long pause could pass,
   and the persona specs require one in every line.
2. `sentenceCount` split inside quoted speech, so a move such as `say 'That does not
   work for me. What else have you got?' and wait` counted as two sentences. The reply
   contract explicitly asks for words to say, so the check was failing the copy the
   contract asks for.
3. The mock client answered everything as `persona`, so mock mode could not reach
   care, meta or clarify at all, including both crisis cases.

Result after the fixes:

```
total   181/181 passed (100.0%)
safety   24/24 passed
harvey   61/61      mike  60/60      donna  60/60
```

Scope note, repeated from the harness's own output: a mock run proves the contract and
the pipeline hold. It says nothing about whether the advice is any good, because mock
fixtures are chosen by persona and route, not by the situation. The release gates in
`harness/rubric.md` section 4 (voice fidelity means, differentiation, three runs per
case) need a live run with `--judge` and a Gemini key. That has not been run here and
remains outstanding before a public launch.

Verdict: **PASS** for the contract layer, gates in rubric section 4 not yet exercised

### 7. Copy and naming sweep

| Sweep | Result |
|---|---|
| Em dash, en dash, horizontal bar, figure dash (U+2012 to U+2015, U+2E3A, U+2E3B) in `.ts`, `.tsx`, `.css`, `.md`, `.json`, `.mjs`, `.html` | PASS, zero hits outside `lib/text.ts` and its test, where they are the scrubber's own fixtures |
| Same sweep over every commit message on this branch | PASS, zero hits |
| Double hyphen used as a pseudo dash in copy | PASS, zero hits (the two matches are a comment in `lib/text.ts` and a CLI flag in `harness/run.ts`) |
| Persona names | PASS. Every surface reads from `PERSONAS`, which resolves through the active pack. No screen hardcodes Harvey, Mike or Donna |
| Intensity names | PASS. `measured`, `sharp`, `nomercy` with labels Measured, Sharp, No mercy, used consistently from `INTENSITY_LABELS` |
| Persona card labels | PASS. Each persona keeps its own set by design: The read / The play / Don't, The precedent / The angle / Watch out, What's really going on / What you do / What you don't |
| App name | FIXED on this branch. Three user-facing strings hardcoded "Specter" instead of `BRAND.appName`, which is the value the persona pack switch is meant to change |
| Screen container class | FIXED on this branch. Four pages used `className="screen"` and three used `"scr"` for the same thing, propped up by a `.scr, .screen` alias. One name now, alias removed (N4) |

Verdict: **PASS**

### 8. Accessibility

Automated, at 390 by 844, across all ten screens. Four hard gates, each failing the
run if broken:

| Gate | Result |
|---|---|
| Every control has an accessible name (aria-label, aria-labelledby, title, associated label, placeholder, or text content) | PASS, zero unnamed controls on any screen |
| Every image has alternative text or is explicitly hidden from assistive technology | PASS, zero |
| At most one `h1` per screen | PASS |
| No horizontal overflow | PASS, see section 9 |

Advisories, reported rather than failed:

- **A1: no `h1` on the welcome screen.** The wordmark is an SVG with an accessible
  name, not a heading, so the first screen of the app has no top level heading. A
  screen reader user gets no landmark to orient on. Low effort fix: make the promise
  line, or the wordmark, the `h1`.
- **A2: tap targets under 44 by 44 CSS pixels.** Not a WCAG AA failure at level AA
  (2.5.5 is AAA), but worth a design decision on a phone first product. Counts per
  screen: welcome 1, sign-in 1, home 4, result 16, care 1, everything else 0. The
  result screen is the one to look at: the icon buttons are 36 by 36, the chips 32
  high, the soft buttons 38 high. The composer mic and send buttons are 40 by 40
  throughout.

Not covered by this pass, and worth a human check before launch: colour contrast
ratios, focus order through the result screen's menus and sheets, and screen reader
behaviour over the spoken line's pause marks.

Verdict: **PASS** on the gates, 2 advisories

### 9. Phone width

390 by 844, the viewport the design system is written against. Horizontal overflow is
measured as `documentElement.scrollWidth - clientWidth` on every screen.

All ten screens: **0 pixels of overflow.**

Verdict: **PASS**

### 10. Screenshots

`docs/qa/shots-02/`, full page, 390 wide, regenerated on every audit run:

| File | Screen |
|---|---|
| `01-welcome.png` | Onboarding, persona choice, age and AI disclosure |
| `02-sign-in.png` | Sign in |
| `03-home.png` | Home, persona rail, starters, composer |
| `04-result.png` | Case result, full thread |
| `05-cases.png` | Cases list with one case |
| `06-saved-empty.png` | Saved lines, empty state |
| `07-settings.png` | Settings, guest session |
| `08-offline.png` | PWA offline fallback |
| `09-not-found.png` | 404 |
| `10-care.png` | Care mode, crisis path |

One reading note for the PM: the composer dock is `position: fixed`, so in a full page
screenshot it is painted at its viewport position and appears to float over the middle
of the result screen. On a real device it sits at the bottom. Nothing is wrong there.

Verdict: **DONE**

---

## 11. Defects found and fixed on this branch

### D1 (would have been P0): the cases and saved lists crashed whenever they had content

Both are server components and both imported `relTime` from `components/ui.tsx`, which
is a `"use client"` module. Next treated that as calling a client function from the
server and threw during render. Any user with one case saw "Application error: a
server-side exception has occurred" instead of their list; the saved list failed the
same way on the first saved line.

Only the empty states worked, which is exactly why two source-code reviews, a clean
build and a clean typecheck all missed it: nothing is wrong until there is data. It
took running the app with a case in it to see, which is what the new e2e suite does.

Fixed by moving `relTime` to `lib/reltime.ts`, a plain module either side can import.
Two e2e tests now fail if it regresses.

### D2: five CSS custom properties used on four screens were never defined

`var(--border)`, `var(--fg-1)`, `var(--fg-3)`, `var(--fg-4)` and `var(--surface-raised)`
appear on welcome, cases, saved and settings. None exist in `globals.css` and none of
the usages carried a fallback.

The visible part is the borders: `border: 1px solid var(--border)` with an undefined
token does not fall back to a default colour, it unsets the whole shorthand. The row
dividers on cases, saved and settings were missing and the unselected persona cards on
the welcome screen had no border. The colours were quieter but wrong too: `--fg-3`
secondary text inherited the full foreground, so timestamps, captions and the legal
line rendered at the same weight as the content above them.

Mapped onto the tokens that do exist rather than adding synonyms: border to `--hair`,
fg-1 to `--fg`, fg-3 to `--muted`, fg-4 to `--dim`.

### D3: the primary button on the welcome screen had no styling

Three places used `className="cta"`. There is no `.cta` rule in `globals.css`. On the
first screen of the app, "Try it free" measured 320 by 23 and rendered as plain text
that read as a caption rather than a button. Compare `shots-02/01-welcome.png` against
the same screen on main.

All three now use `.btn.primary`, which the design system already defines. The settings
one also pointed at `/sign-up`, a route that does not exist in the app router, so any
guest tapping it got the 404.

### D4 (reported, not fixed): every follow-up on the result screen is inert

Found by writing tests for the second visit, the one nothing had ever exercised.

On the case result screen, "New take", "Ask Mike", "Ask Donna" and the composer's
push back all call `goThread`, which stores the request with `setPending` and then
routes to `/cases/[id]`, the screen the user is already on. Nothing anywhere in the
codebase calls `takePending`. The request is dropped.

Verified with a network probe against the running app: after the opening consult, the
only request ever sent to `/api/consult` is that first one. Clicking "New take",
sending a push back and tapping "Ask Mike" each produce zero network calls, zero new
replies and no visible change. A user who types a follow-up watches their text vanish.

This is not a broken feature, it is an unbuilt screen. `docs/design/screens.md`
section 12 specifies screen F17, the case thread, as the place every follow-up lands
(design review 01 finding B9, confirmed resolved in design review 02). There is no
route for it. `ResultView`'s own comment says so: "the first reply of a case.
Everything after it goes to the thread."

The server side is complete. Posting `action: "followup"` to `/api/consult` creates
the consult correctly and the case then holds two, confirmed directly against the API.
Only the screen is missing.

Also from section 12 and B9, and so also not currently true: opening a case from the
cases list should open the thread, and back from the thread should go Home.

Out of scope for an unattended overnight run: F17 is an approved, fully specified
screen, not a defect, and building it belongs in the normal design to build to review
loop rather than being improvised at six in the morning. Raised to the PM as P0-B.

---

## 12. Backlog items from release-review-02

| Item | State |
|---|---|
| P0-A, Vercel deploy `b6a493e` ERROR | RESOLVED before this branch. Cause was `ENOENT ... app/(app)/page_client-reference-manifest.js`: the commit added a root `app/page.tsx` that collided with `app/(app)/page.tsx` for the same route. Removed in 1ecf28d. Twelve production deploys since are READY |
| P1-A, Supabase Auth redirect URLs | OPEN, founder only, dashboard access required |
| P2-A, loading.tsx per segment | DONE on main (524e476), verified: cases, cases/[id] and saved each have a skeleton using the shared `sk` treatment. Caught live in an earlier screenshot run |
| P2-B, branded not-found | DONE on this branch. The file existed but used inline styles and a hardcoded `#4f8ef7` matching no token, so an unknown route looked like a different app. Rebuilt on the same centred column as sign-in and offline |
| P2-C, P2-F, N3, mic inert on home | DONE on main (524e476), verified from both sides: present and enabled where dictation is supported, absent where the speech APIs are removed before page scripts run |
| P2-D, stacked bottom nav on the result screen | DONE on main (524e476), verified: `TabBar` is rendered per page and `cases/[id]` does not render it |
| P2-E, guest tracking in sessionStorage | NO ACTION, as reviewed. The server side quota is the real limit |
| N1, `GUEST_HASH_SALT` | OPEN, founder only, Vercel env |
| N2, stale `ANTHROPIC_MODEL` | OPEN, founder only, Vercel env |
| N4, `screen` versus `scr` | DONE on this branch |
| N5, PWA offline fallback | DONE on main (e04fa19), verified: `/offline` is precached in the service worker shell and served as the navigation fallback. E2e asserts both the page and the worker reference |

---

## 13. Not covered by this gate

Stated plainly so nobody reads a PASS as more than it is.

- **Live model quality.** Everything here ran against fixtures. The rubric's release
  gates (safety 100 percent per persona, 90 percent elsewhere, voice fidelity mean at
  least 4.2, differentiation at least 85 percent, three runs per case) need
  `npm run harness -- --judge` with a Gemini key.
- **Real Supabase.** Auth, RLS and the nine table schema were exercised through the
  in-memory store, not Postgres. Sign-in cannot be tested end to end until P1-A is
  done.
- **Real speech.** Deepgram STT and browser speechSynthesis are both stubbed. Voice
  input and voice output need a device.
- **iOS Safari and Android Chrome.** All of the above ran in headless Chromium at one
  viewport. A phone first product needs a real phone before launch, particularly for
  the safe area insets and the PWA install flow.
- **Colour contrast and focus order**, as noted in section 8.

---

## Sign-off

All ten checks pass. Four defects were found during the gate. Three are fixed on the
branch and covered by tests that fail if they return, including D1, which broke two of
the app's six screens for any user with data. The fourth, D4, is a missing screen and
is raised to the PM rather than improvised overnight. The branch is clean on build, typecheck,
lint, 95 unit tests, 20 e2e tests (4 skipped against D4) and 181 harness rows.

**QA verdict: PASS.** Cleared for PM review on `fix/release-review-02-backlog`. Not
cleared for public launch: D4 leaves the whole post-first-reply loop dead, the live
model gates in section 13 are still outstanding, and P1-A still blocks real sign-in.

Signed off by: QA agent, 2026-10-26, commit e624565 on `fix/release-review-02-backlog`.
