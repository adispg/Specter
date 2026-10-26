# Specter: project documentation and handover

Last updated 26 October 2026, 08:30 IST.

Written so that a new person, or a fresh AI session with no memory of this work,
can pick the project up cold. It records what the app is, how it is built, what
was wrong and why, what is still wrong, and the traps that cost the most time.

---

## 1. What this is

A mobile-first web app. The user types a real workplace situation and gets back
advice in the voice of one of three advisor personas, modelled on the Suits
archetypes. The reply is structured, not a chat message: a short quotable line,
a read of what is really going on, up to three concrete plays, something to
avoid, and a one-line principle. It can speak the reply aloud.

**Current product direction**, set by the founder on 26 October: this should be
something people open when they are bored or annoyed at work, that gives a light
moment plus genuinely good insight, and that they would send to a colleague. It
is deliberately not a crisis-only advice tool. Research supporting this is
summarised in section 9.

### Non-negotiable constraints

These are product and legal constraints, not preferences. Do not relax them.

1. Never reproduce, quote, or store actual dialogue, subtitles or scripts from
   the television show Suits. Archetypes and rhetorical patterns described in
   original words are fine. Anything that reads as a quotation is not.
2. Never imitate or clone a real actor's voice. Device and stock voices only.
3. No em dashes or en dashes in any user-facing copy or generated output. The
   model is instructed on this and output is scrubbed in `lib/text.ts`.
4. Persona keys in stored data are `closer`, `prodigy`, `insider`. Never the
   character names. The display names live in `lib/personas/config.ts` and are
   swappable via `NEXT_PUBLIC_PERSONA_PACK`.
5. API keys are added by the founder in the Vercel dashboard. Never pasted into
   chat, never committed.

---

## 2. Live environment

| Thing | Value |
|---|---|
| Production | https://specter-adityaguptaiiml-4524.vercel.app |
| Repo | github.com/adispg/Specter, branch `main` |
| Hosting | Vercel, project `specter`, auto-deploys from `main` |
| Database and auth | Supabase project `ujvszwvpvolosbfqfojf`, region ap-south-1 |
| Model | Google Gemini |
| Local clone | `F:\VIBE\Harvey Specter\specter-app` |

Vercel Authentication (deployment protection) must stay **off** or the whole
site redirects to a Vercel login page.

Supabase **anonymous sign-ins must stay enabled** (Authentication, Providers)
or guest mode fails.

---

## 3. Architecture

Next.js 15 App Router, React 19, TypeScript, Supabase, deployed on Vercel.

```
app/
  (app)/              routes behind auth, share a layout that checks the session
    page.tsx            "/" home, the consult composer
    cases/, saved/, settings/
  welcome/            onboarding and guest sign-in, public
  sign-in/            email magic link and Google, public
  offline/            service worker fallback, public
  api/                route handlers: consult, auth, profile, saved, feedback, tts, stt
components/           all UI, client components
lib/
  consult/            schema, engine, service, gemini, mock. The reply contract lives here.
  personas/           config (personas, themes, copy), prompt assembly, rules (the system prompt)
  data/               store interface, Supabase and in-memory implementations
  supabase/           browser, server and middleware clients
  client/             hooks: useConsult, performer (speech), dictation (mic)
harness/              evaluation harness: run.ts, checks.ts, judge.ts, situations.json
supabase/migrations/  schema
docs/                 BRIEF, PRD, design specs, harness specs, reviews
```

### Request flow for one consult

1. Client posts to `/api/consult`.
2. `withSession` in `lib/api.ts` requires a session (guests count).
3. `runConsult` in `lib/consult/service.ts`: loads the thread, safety screen,
   daily caps, guest limits, weekly free tier, intensity downgrade.
4. `buildSystemPrompt` assembles persona bible, shared rules, intent hints and
   the output contract. `buildTurns` rebuilds the conversation.
5. `generateReply` in `lib/consult/engine.ts` calls the model, parses, validates
   against the Zod contract, and retries once with a repair prompt.
6. `persist` writes the case, the consult and a usage event.

### The reply contract

Defined in `lib/consult/schema.ts`. Every reply is one JSON object with eleven
keys. `mode` decides which are required:

| mode | when | play | principle, avoid |
|---|---|---|---|
| `persona` | a real situation with enough detail | exactly 3 | required |
| `decline` | harmful or illegal request | exactly 3 | required |
| `care` | distress or crisis, persona dropped entirely | 1 to 3 safety steps | optional |
| `meta` | capability question, greeting, off topic | 0 to 3 examples | optional |
| `clarify` | real but far too thin to answer | 1 to 3 questions | optional |

`meta` and `clarify` were added on 26 October. Before them every input was
forced down the `persona` path, so "what can you do" produced a crisis plan.

**If you add a mode you must also widen the `consults_mode_check` constraint in
the database.** A test enforces this: `tests/unit/schema.test.ts` parses the
migrations and fails if the SQL and `MODES` disagree.

---

## 4. Running it

```bash
npm install
npm run dev              # needs .env.local, see section 5
npm run build
npx tsc --noEmit         # typecheck
npx vitest run tests/unit  # 75 tests
npm run harness:mock     # 181 contract checks, no API key needed
npm run harness -- --judge # model-scored quality, needs GEMINI_API_KEY
```

`MOCK_AI=1` runs with deterministic fixtures and no API key. It is disabled on
Vercel production regardless of the variable.

---

## 5. Environment variables

Set in Vercel, Settings, Environment Variables. All three targets.

| Variable | Status | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | set | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | set | |
| `GEMINI_API_KEY` | set | from aistudio.google.com/apikey |
| `GUEST_CONSULTS` | 25 | guest consults before sign-in |
| `GUEST_CONSULTS_PER_DEVICE_PER_DAY` | 25 | defaults to 1, which kills a demo |
| `GUEST_CONSULTS_PER_IP_PER_DAY` | 200 | defaults to 5, shared office wifi is one IP |
| `GUEST_HASH_SALT` | **EMPTY, fix this** | falls back to a value published in this repo |
| `DEEPGRAM_API_KEY` | empty | optional, only for browsers without native speech recognition |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `ELEVENLABS_*` | unused | left from an earlier design, safe to delete |

Changes need a redeploy to take effect.

---

## 6. What was broken, and why it mattered

Recorded because several of these were invisible from the source and cost hours.

**`app/page.tsx` shadowed the real home page.** Both it and `app/(app)/page.tsx`
resolved to `/`. Next picked the former, whose entire body was an unconditional
`redirect("/welcome")` with no auth check. Taking no input, it was statically
prerendered, baking a permanent 307 into the build output. Every request to `/`
got that frozen redirect and no auth code ran at all. This presented as guest
sign-in looping back to the welcome screen, and no amount of clearing cookies or
using a private window changed it. The same shadowing also caused a Vercel build
failure by emitting a client reference manifest to the wrong path. Deleting one
file fixed both. **Lesson: the build output had the answer the whole time.**

**`gemini-2.0-flash` was retired by Google.** Every consult 404'd. It was
invisible because the error handler tested `msg.includes("5")`, which matches
almost any message, and relabelled everything as a rate limit. Hours were spent
debugging a fiction. There is now a model fallback chain and the real HTTP
status is read and logged.

**`maxOutputTokens` was 1000.** Gemini 3.x spends output budget on internal
reasoning before writing, so the JSON truncated and every reply failed
validation as "garbled". Now 4000.

**`/sign-in` and `/offline` did not exist.** `/sign-in` was linked from the
welcome screen and targeted by the middleware, sign out and every auth error
path. `SignInForm` was fully built with no page to host it. `/offline` was
precached by the service worker, and `cache.addAll` rejects the whole batch if
any entry 404s, so the worker failed to install on every single load and nothing
was ever cached.

**Ask Mike, Ask Donna, New take and the follow-up composer were all dead.** They
stashed a request via `setPending` and pushed to the route they were already on,
which Next treats as a no-op. Nothing in the app ever called `takePending`.

**The tab bar covered the composer.** Both are `position: sticky; bottom: 0`.
While the page itself scrolled they pinned to the same point and the tab bar,
later in the DOM, painted over the input. Taps meant for send hit the nav.

**Voice picked the wrong gender on Android.** `speechSynthesis.getVoices()`
populates asynchronously and nothing listened for `voiceschanged`, so the first
call returned an empty array and the device default was used. Desktop hid this
because its list was already cached.

**Guest quota was charged for failed consults.** Consumed at step 4, model not
called until step 7.

### The pattern

Most of these are the same failure: something built, then never connected. The
mic existed but was not passed to the home composer. Persona empty-state copy
was written and never rendered. `SignInForm` had no page. Reading the source
proves a thing exists, not that it is reachable. Click it.

---

## 7. Known traps

- Changing `MODES` without the database constraint causes a 500 on insert.
- Vercel's redeploy API reuses cached build artifacts. To force a genuinely
  fresh build, push a commit.
- `npm run test:all` includes an empty Playwright suite.
- Env var changes need a redeploy.
- The harness mock run proves the contract and pipeline hold, not that the
  advice is any good. Only `--judge` speaks to quality.

---

## 8. Current state

Working and verified on production: guest sign-in, the full consult flow, all
five reply modes, voice playback, voice input on both screens, the case thread,
saved lines, the home screen, sign-in, offline.

Known weak: consult latency is about 19 seconds, of which roughly 14 is the
model. The likely cause is that the installed SDK, `@google/generative-ai`
0.24.1, is deprecated and offers no way to cap Gemini 3.x hidden reasoning. The
current SDK, `@google/genai`, does. This is the single biggest available win.

There is no monitoring of any kind. No error tracking, no alerting.

Security: row level security is enabled on every table with correct per-user
policies, and no cross-user read or write path was found. Both redirect surfaces
are restricted to same-origin. The guest throttle is weak by construction, a
clearable cookie, and `GUEST_HASH_SALT` is unset.

---

## 9. Product direction and research

**The occasion.** Most office time is not a crisis. The moments that bring
someone back are the bad meeting that just ended, the passive-aggressive message
just received, the dead fifteen minutes before a call. In four of five such
moments the person does not want a plan, they want to feel accurately read.

**Shareability.** High-arousal emotions, anger and amusement, drive sharing far
more than low-arousal ones. Post-meeting irritation is the most shareable state
in the office day. But today's reply is not shareable, because it embeds the
user's own situation and names their colleagues. The shareable unit is the
`line` plus the `principle`, standing alone, with the situation stripped, so the
recipient supplies their own manager. **IP guardrail: a share card must carry
Specter branding only, never a character name.** Private use under character
names is one risk posture; public distribution is materially worse.

**Humour calibration.** One rule: wit lives in the diagnosis, never the
prescription. `read` and `avoid` can be dry and cutting. `play` stays plain and
executable, because a joke inside a move makes the move useless. This is
implemented as the WHERE THE WIT GOES section of `COMMON_RULES`.

**The vent intent, not yet built.** The founder's own framing: he spent a Sunday
and three sessions of tokens getting this app working, and what he wants for
that story is not advice, it is the line that gets the laugh when he tells a
colleague. The app has no intent for "something absurd happened, give me the
line". It pairs directly with the share card and is the clearest expression of
the product.

---

## 10. Tracker

See `SPECTER-TRACKER.xlsx` beside this file. 46 items, 30 complete.

The highest-value remaining work, in order:

1. The share card. Nothing else turns a private tool into something that travels
   between desks, which is the stated goal.
2. The vent intent and a light reply path for low-stakes input.
3. Latency, via the SDK migration.
4. A sweep of every remaining control for dead wiring.
5. Monitoring.
