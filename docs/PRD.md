# Specter: Product Requirements (MVP)

Owner: Product. Status: v1.0 for build. Read with `docs/BRIEF.md` (hard constraints win over anything here), `docs/harness/persona-specs.md`, `docs/harness/intents.md`, `harness/situations.json` and `harness/rubric.md`.

## 1. Problem

People face a steady run of moments that matter: a salary call tomorrow, a boss who took credit, a relative who keeps crossing a line, a client threatening to walk. In the hour before (or the evening after) they want two things at once: a clear read on what is really going on, and the words and posture to carry it off. Today they get one or the other. Friends are kind but vague, generic AI chat is thorough but flat and long, and coaching is expensive and scheduled days out.

Specter gives a fast, quotable, spoken answer in a voice with a point of view, then a concrete three-step play. The persona is the delivery; the advice underneath must be sound, legal and specific.

What Specter is not: therapy, a companion or a legal adviser. It is situational coaching for moments. This framing drives scope, safety and regulatory posture (see Risks).

## 2. Target users and jobs to be done

Primary: working professionals aged 22 to 40 in competitive environments (consulting, finance, tech, sales, startups), early to mid career, English speaking, fans of confident on-screen archetypes. Launch markets: India and the US, then UK.

Secondary: founders and managers who face many people moments a week; students preparing for interviews.

Jobs (in the user's words):
1. "I have a moment coming up. Tell me how to walk in and what to say." (prepare)
2. "Something just happened. Tell me what it means and what to do next." (react)
3. "I'm stuck between options. Make the call with me." (decide)
4. "I need to hear it with conviction so I believe it." (confidence; the spoken delivery is the product, not decoration)
5. "Give me one line I can actually use or keep." (quotable, saveable)

Each job maps to intents in `docs/harness/intents.md`.

## 3. Product principles

1. Moment first: every screen exists to get the user from situation to a usable line in under a minute.
2. Sound advice, strong delivery: the play must survive a sceptical friend reading it. Persona flavour never overrides judgement, legality or kindness to third parties.
3. Original always: no show dialogue, no catchphrases, no actor voices.
4. Persona swappable: names, colours, copy, voices and prompts come from one config (`personas` config module). A rename to original characters must be a config change plus copy review, not a refactor.
5. Safety beats character: crisis signals switch the app into Care mode instantly.
6. Private by default: situations contain third parties' details. Store the minimum, never sell or train on it, let users delete everything.

## 4. Scope

### MVP (this build)
- Installable PWA, mobile first, dark premium UI from the prototype.
- Three personas: Harvey, Mike, Donna (config driven).
- Onboarding with age gate (18+), safety and AI disclosure, persona pick, optional first consult as guest.
- Sign in: email magic link and Google OAuth (Supabase). Guest consult before sign in (see 6.2).
- Consult by text or voice (Web Speech API, MediaRecorder fallback to server STT).
- Structured reply: matter, line, follow-up two-liner, read, three-step play, avoid, principle.
- Spoken reply via ElevenLabs stock voices with pause marks; browser speech fallback; word highlighting and glowing pauses.
- Follow-up and push back on the same case; "another line" (new angle, same persona).
- Switch persona on the same case: each persona gives its own consult on the shared situation.
- Intensity setting: Measured, Sharp, No mercy.
- Case history (list, open, rename, delete) and saved lines (save, copy, share as text, delete).
- Optional "when is it happening?" on a case, with an in-app debrief card after that time ("How did it go?").
- Thumbs up or down per consult with optional reason.
- Settings: voice on or off, speed, intensity default, default persona, voice per persona from an allowed list, replay without voice.
- Data export (JSON) and delete account.
- Care mode for crisis signals; decline-and-redirect for harmful requests; locale-aware helplines.
- Usage quota for free tier (enforced server side) with a paywall stub behind a feature flag.
- Eval harness in `harness/` with LLM judge, run in CI on prompt changes.

### Later (v1.1 and beyond, in rough priority)
1. Web push reminders before a moment and debrief nudges after (iOS requires home screen install; ship once install rate is known).
2. Rehearse mode: the persona plays the other side of the conversation by voice so the user can practise.
3. Payments (Stripe on web first to avoid store fees), plans and trial.
4. Shareable line cards (image) with attribution to Specter, not to the show. Gate on licensing decision.
5. Native apps (Capacitor or React Native) for push and audio reliability.
6. Original character pack for commercial launch, or licensed pack if NBCUniversal deal lands.
7. Hindi and Hinglish input; regional voices.
8. Streaks or weekly "moments handled" recap (only if it does not create compulsive use).
9. Team or manager plans.

Explicitly out of scope: open-ended companion chat, romance roleplay, legal, medical or financial advice beyond general guidance, user-created personas, voice cloning of anyone.

## 5. Key product decisions (with rationale)

| Decision | Rationale |
|---|---|
| A Case is persona agnostic; a Consult belongs to one persona | Enables switch persona on the same case without retyping, and comparison of angles. |
| Reply schema leads with `mode`, then `line` and `followup` | Lets the server start TTS on the line while the rest streams, cutting time to first word. Mode lets the UI switch to Care mode before rendering any persona styling. |
| Only line and followup are spoken by default | They carry the voice; TTS is the largest per-consult cost; the play is read, not heard. A "read the play aloud" toggle is available. |
| Guest first consult | Activation research on subscription apps shows most conversion and most trial cancellation happen on day 0; the first spoken line is the aha moment and should come before any sign in wall. |
| 18+ only | Persona coaching with "No mercy" intensity is unsuitable for minors, and companion-chatbot laws impose extra duties for minors. |
| Care mode is a distinct UI state, not a persona | The brief requires dropping the act; a neutral visual and voice treatment makes that unmistakable. |
| Mike never invents facts | His persona reaches for precedent and data, which tempts the model to fabricate statistics and studies. Spec forbids invented numbers, studies, names and quotes. |
| Persona advice grounded in real practice | Negotiation trainers note that on-screen pressure tactics produce brittle agreements. Harvey's leverage style is kept for delivery; his plays must aim for deals that hold and relationships the user still needs. |
| No catchphrase list stored anywhere | Storing a denylist of show lines would itself store dialogue. The judge flags lines it recognises as show dialogue; prompts forbid them. |

## 6. Core flows

### 6.1 Onboarding (first launch)
1. Splash with the three personas and a one-sentence promise.
2. Age confirmation (18+) and a short card: "Specter is an AI coach, not a person, lawyer or therapist. If you are in danger, contact emergency services." Link to safety policy. Both must be acknowledged.
3. Pick a persona (can change any time). Each card plays a 3 second original sample line in that voice on tap.
4. Composer opens with example chips relevant to common intents and a mic button. Microphone permission is requested only on first mic tap.
5. After the first reply plays, prompt to save the case by signing in.

Target: first spoken line within 60 seconds of opening the app for 50% of new users.

### 6.2 Sign in
- Email magic link or Google OAuth via Supabase.
- Guest mode: Supabase anonymous sign in gives a temporary user id; one free consult (plus follow-ups on it) before sign in is required. On sign in the anonymous user is linked so the case is kept.
- Rate limit guest consults per device and IP to stop abuse.

### 6.3 Consult by voice or text
1. User types or holds the mic. Live transcript shows while speaking (Web Speech API); fallback records audio and posts to `/api/stt`.
2. User can edit the transcript before sending. Minimum 8 characters, maximum 4,000.
3. Server: auth and quota check, safety pre-screen (cheap rules plus the model's own `mode`), build prompt from persona config, common rules, intensity and history, call Anthropic, validate JSON with zod, retry once on invalid JSON, strip any dash characters, persist.
4. While waiting, persona specific thinking copy rotates (from config).
5. Reply renders; audio starts automatically if voice is on.

### 6.4 Spoken reply
- Line then followup, with "|" and "||" converted to ElevenLabs break tags per persona timing in config.
- Words highlight as spoken; pause marks glow during silence; avatar halo pulses.
- Controls: play or pause, stop, replay, speed. Audio is cached by hash of (text, voice, speed) so replays cost nothing.
- Fallback: browser speechSynthesis with segment gaps when no ElevenLabs key or on error.

### 6.5 Follow up and push back
- Composer placeholder changes to "Push back, or tell [persona] what happened next".
- Each follow-up creates a new Consult on the same case with the prior turns as history (cap at last 8 turns plus the original situation).
- Push back is honoured: the persona may hold its position if the advice was right, explaining why in one sentence, or adjust. It must not cave just because the user disagrees (anti sycophancy check in harness).
- "Another line": same persona, new angle, same JSON shape.

### 6.6 Switch persona on the same case
- Tapping a different persona on an open case shows "Ask [persona] about this" if they have not been consulted, or their existing consult if they have.
- The new persona gets the original situation plus a short neutral summary of follow-ups, not the other persona's advice (avoids anchoring and keeps angles distinct).

### 6.7 Case history
- List sorted by last activity: matter title, persona avatars consulted, date, moment time if set.
- Open a case to see consults per persona and follow-ups in order.
- Rename, delete (hard delete of case, consults and audio cache entries for it).
- Debrief card appears on open after `moment_at`: Used it / Partly / Didn't, plus optional note. The answer is shown to the persona if the user continues the case.

### 6.8 Saved lines
- Save from any reply (line plus followup, persona, matter).
- Library view with filter by persona, copy, share as plain text with "via Specter" suffix, delete.

### 6.9 Settings
- Voice on or off, speed (0.8x to 1.2x), read play aloud toggle, intensity default, default persona, voice per persona (from allowed stock list in config).
- Privacy: export data, delete all cases, delete account, links to privacy and safety policies.
- About: "Specter is an AI. Characters are fictional." plus licensing notice text from config.

### 6.10 Delete account
- Settings, Delete account, confirm by typing DELETE.
- Immediate: sign out, all user rows deleted via cascade, cached audio deleted, Supabase auth user deleted via server route with service role.
- Backups purge within 30 days (stated in privacy policy). Aggregate, non identifying metrics may remain.

### 6.11 Care mode and declines
- If the model returns `mode: "care"` (or the pre-screen fires), UI drops persona tint to a neutral theme, hides persona avatar, labels and billing joke, shows a warm plain message and helplines for the user's locale (India Tele-MANAS 14416, US 988, UK Samaritans 116 123, otherwise local emergency number), with a button to call. TTS uses a neutral calm voice at normal pace with no pause theatrics, or stays silent if voice is off.
- If `mode: "decline"` (illegal or harmful request), persona stays but the reply redirects to a legal, safe alternative that still serves the user's underlying goal.
- Care mode events log a minimal `safety_events` row (category, timestamp, no situation text).

## 7. Reply contract (for engineer and harness)

```
{
  "mode": "persona" | "care" | "decline",
  "matter": "3 to 6 word case title",
  "line": "one-liner with pause marks, max 24 words",
  "followup": "exactly two sentences with pause marks",
  "read": "one or two sentences on what is really going on",
  "play": ["three moves, one sentence each"],
  "avoid": "one sentence",
  "principle": "3 to 7 word original maxim",
  "intent": "one key from intents.md",
  "stakes": "low" | "medium" | "high",
  "hours": 0.1 to 0.6
}
```
In care mode: `line` and `followup` hold the plain warm message (no pause marks), `play` holds up to three concrete safety steps, `principle` and `hours` are omitted or ignored by the UI. Server post processing: replace any em or en dash with a comma, collapse whitespace, enforce limits, reject and retry once if invalid.

## 8. User stories and acceptance criteria (MVP)

US1 First consult as guest
- Given a new visitor who confirmed 18+ and the disclosure, when they type a situation of 8+ characters and send, then a valid reply renders and, with voice on, audio starts within 6 s p50 and 10 s p95 of send.
- The reply never contains an em or en dash.
- A save prompt appears after playback; dismissing it keeps the reply visible.

US2 Sign in and keep my case
- Given a guest with one case, when they sign in with magic link or Google, then the case appears in history under their account.
- Magic link email arrives and works on the same device; expired links show a clear retry.

US3 Speak my situation
- Given mic permission, when the user holds or taps the mic, then a live transcript appears (or a recording indicator in fallback) and the text is editable before send.
- If permission is denied, a single explanatory message shows and text input remains usable.

US4 Hear it delivered
- Pause marks produce audible silences matching persona config timing (within 150 ms).
- Highlighting tracks the spoken word; stop halts audio within 200 ms.
- Without an ElevenLabs key, browser speech plays with the same segment gaps.

US5 Push back
- Given a reply, when the user sends a follow-up, then a new consult on the same case returns, references the new information specifically, and keeps the same JSON shape.
- If the user pushes back on sound advice, the persona can hold position with a reason (harness case checks).

US6 Another line
- Returns a line with less than 50% word overlap with the previous line on the same consult chain.

US7 Switch persona
- Given a case with a Harvey consult, when the user taps Donna and asks, then Donna's consult uses the same situation, renders in Donna's theme and voice, and her line differs in angle (harness differentiation check).
- Switching back shows Harvey's existing consult without a new API call.

US8 Case history
- Cases list shows title, personas consulted and last activity; opening shows all consults in order.
- Deleting a case removes it and its consults, saved lines from it and cached audio, after confirmation.

US9 Saved lines
- Save toggles on the reply; saved items appear in the library with persona and matter; copy places plain text (no pause marks) on clipboard.

US10 Settings
- Changes persist to the profile and apply on the next reply; voice off means no audio requests are made.

US11 Delete account
- After confirmation, the user is signed out, cannot sign back in to see any prior data, and all their rows are gone (verified by an RLS bypassing admin query in test).

US12 Care mode
- For every safety case in `harness/situations.json`, the app shows Care mode or a decline as specified, with correct helplines for the test locale, and no persona styling in Care mode.
- Care mode never shows "No mercy" style content regardless of intensity.

US13 Quota
- Free tier users who exceed the weekly limit see the paywall stub; the API returns 402 and makes no model call. Care mode responses are never blocked by quota.

US14 Data export
- Export downloads a JSON file with profile, cases, consults and saved lines for that user only.

Non functional: Lighthouse PWA installable; WCAG AA contrast; works on iOS Safari 17+ and Chrome Android; all API keys server side only; RLS on every user table; `MOCK_AI=1` makes all flows testable without keys.

## 9. Success metrics

North star: Moments handled per week, defined as consults followed by a positive debrief ("Used it" or "Partly"), or a save, or a follow-up. It captures that the advice was used, not just heard.

Activation
- A1: % of new visitors who hear a full spoken reply to their own situation in session one. Target 55%.
- A2: Time from first open to first spoken word, p50. Target under 60 s.
- A3: Guest to signed in conversion after first consult. Target 35%.

Engagement and retention (consumer AI apps churn faster than average, so targets are set as hypotheses to beat)
- D1 return 30%, D7 18%, D30 10% for signed in users.
- Consults per weekly active user: 3 or more.
- Debrief response rate on cases with a moment time: 40%; positive share of debriefs: 65%.
- Persona switch rate: 20% of cases get a second persona (signal that multi persona is valued).

Quality
- Thumbs up rate 75% or higher; save rate 15% of consults; replay rate as a delight signal.
- Harness pass rate 90% or higher on non safety cases, 100% on safety cases, per release.
- Safety: zero Care mode misses on the safety eval set; weekly human review of a sample of flagged and unflagged consults.

Performance and cost
- Time to first audio p50 6 s, p95 10 s. Model JSON validity 99.5% after one retry.
- Blended cost per consult under USD 0.04 (see 11.4).

## 10. Monetisation hypotheses

H1 Freemium with a weekly allowance converts better for this use case than a hard paywall, because moments are episodic and users need to experience two or three of them. Test: 3 free consults per week (follow-ups on the same case free up to 5) versus a 7 day full trial with hard paywall.
H2 Annual plans retain far better than monthly; lead with annual at a large effective discount. Starting prices: India INR 299 monthly or INR 1,999 yearly; US USD 7.99 monthly or USD 49.99 yearly. Benchmarks for subscription apps put median monthly near USD 10 and yearly near USD 35, with AI apps earning more per payer but churning faster.
H3 Voice is the premium hook: free tier gets voice on the first consult each day, then text with browser voice; Pro gets studio voices, all personas, unlimited history and rehearse mode.
H4 Longer trials convert better than 3 day trials for considered purchases; test 7 versus 14 days once payments ship.
H5 Pay per moment (single "big moment pack" with rehearse) may suit irregular users; test after subscriptions.

Web payments via Stripe first (PWA) to avoid app store commission; revisit when native ships.

## 11. Risks and mitigations

### 11.1 IP and licensing
Risk: Harvey Specter, Mike Ross and Donna Paulsen are NBCUniversal characters. Distinctively delineated characters can be protected by copyright, and the names carry trademark and passing off risk; a paid launch under those names needs a licence. Actors' voices and likeness are protected by publicity rights.
Mitigations: all generated lines original; no dialogue stored; no actor voice cloning (stock voices only); no show imagery, logos or actor photos; persona names, colours, copy and voices in one config with an original character pack ready (working names to be chosen by founder); "fan inspired, not affiliated" notice in config; keep the named version to a private beta or unpaid preview until a licence decision. Founder decision required (see section 13).

### 11.2 Safety
Risks: user in crisis receiving persona swagger; requests for illegal or harmful tactics (stalking, revenge, fraud, coercion); "No mercy" intensity hurting a vulnerable user; sycophancy (persona agrees with a bad plan); minors.
Mitigations: Care mode with locale helplines and neutral UI; rules plus model level detection; intensity auto drops to Measured when distress is detected; decline-and-redirect pattern serves the legitimate goal; anti sycophancy rules in persona spec; 18+ gate; AI disclosure at onboarding and in About; published safety protocol (required for companion style bots under California SB 243 and good practice anywhere); harness safety cases gate every release; weekly human review sample.

### 11.3 Privacy
Risks: situations include names, health, money and third parties' details; voice recordings; breach exposure.
Mitigations: RLS on all tables; no raw situation text in logs, analytics or error tracking (hash or redact); voice audio never stored, only transcripts the user chose to send; LLM and TTS providers used under API terms that exclude training on customer data (verify current terms before launch); user can delete any case or the whole account; data export; privacy policy aligned with India DPDP Act 2023 and GDPR; optional auto delete of cases after 90 days (setting, default off in MVP, on by default to consider later).

### 11.4 Cost per consult
Estimate for one initial consult on Sonnet 5.5 (USD 2 input, 10 output per million tokens; cache reads at 5% of input):
- Prompt about 2,800 tokens (persona spec and rules about 2,500, cacheable) plus 600 output tokens: about USD 0.007 with caching, USD 0.012 without.
- TTS of line plus followup, about 350 characters: USD 0.018 on ElevenLabs Flash or Turbo (USD 0.05 per 1,000 characters), USD 0.035 on Multilingual (USD 0.10 per 1,000).
- STT fallback, 30 s: under USD 0.003.
- Total: about USD 0.025 to 0.045 per initial consult; follow-ups slightly more on tokens. Voice is the largest line item.
Mitigations: prompt caching of the static persona block; Flash TTS by default; audio cache for replays; speak only line and followup; free tier voice cap; per user daily hard cap; Haiku as fallback model for "another line" if quality holds in harness; budget alerts.

### 11.5 Quality and brand
Risks: persona drift into generic coaching, repeated tics, invented facts, show quotes, long answers.
Mitigations: persona specs with delivery rules; harness with must and must_not checks; deterministic checks (dashes, lengths, pause marks); LLM judge calibrated against a human graded set; prompt versioning stored on every consult so regressions can be traced.

### 11.6 Platform
Risks: Web Speech API gaps on iOS; autoplay restrictions; PWA push limited on iOS.
Mitigations: MediaRecorder plus server STT fallback; audio unlocked on first user gesture; push deferred to v1.1; native later.

## 12. Data model sketch

All tables have `id uuid pk`, `created_at`, `updated_at`; all user owned tables have `user_id uuid references auth.users on delete cascade` and RLS `user_id = auth.uid()`.

- `profiles`: user_id (pk), display_name, locale, country, age_confirmed_at, disclosure_ack_at, default_persona, intensity_default (measured, sharp, nomercy), voice_enabled, speech_rate, read_play_aloud, voice_prefs jsonb (persona_key to voice_id), plan (free, pro), plan_renews_at.
- `cases`: user_id, title (matter), situation (text, max 4000), intent, stakes, moment_at nullable, debrief_status (none, used, partly, not_used), debrief_note, last_activity_at, archived_at.
- `consults`: case_id (cascade), user_id, persona_key (text, matches config key), kind (initial, followup, another, switch), user_input (text), reply jsonb (validated contract), mode (persona, care, decline), intensity, model, prompt_version, tokens_in, tokens_out, cache_read_tokens, latency_ms, tts_chars, error_code nullable.
- `saved_lines`: user_id, consult_id (cascade), persona_key, line_text (plain, no marks), line_marked (with marks), followup_text, matter.
- `feedback`: user_id, consult_id (cascade), rating (up, down), reason (too long, off target, not their voice, unsafe, other), note.
- `usage_counters`: user_id, period_start (week), consults_used, tts_chars_used.
- `safety_events`: user_id nullable (set null on delete), consult_id nullable, category (crisis, self_harm, violence, illegal_request, abuse, minor_suspected), action (care_mode, decline), locale. No situation text.
- `audio_cache`: hash (pk of text, voice_id, rate), storage_path, chars, user_id nullable, last_used_at. Purge unused after 30 days and on case delete.
- Config, not database: personas (key, display name, short name, initials, role line, labels, thinking copy, meta copy, theme tokens, voice ids per provider, pause timings, prompt bible), intents list, helplines by country, licensing notice.

Indexes: cases (user_id, last_activity_at desc); consults (case_id, created_at); saved_lines (user_id, created_at desc).

## 13. Decisions the founder must make

1. Launch naming: private beta under the show names, then switch to original characters for paid launch, or pursue an NBCUniversal licence first. Recommendation: build both packs now; launch paid only with originals unless a licence is signed.
2. Guest consult before sign in: recommended yes (activation), with abuse rate limits.
3. Free tier shape and prices (section 10), and whether India and US pricing ship together.
4. Default intensity for new users: recommended Sharp, with Measured auto applied when distress is detected.
5. Launch geography and helpline coverage (India, US, UK at minimum).
6. Data retention default: keep until deleted versus auto delete after 90 days.
7. Whether "read the play aloud" is free or Pro, given TTS cost.

## 14. Sources consulted
- RevenueCat State of Subscription Apps findings as reported: https://ppc.land/ai-apps-earn-41-more-per-user-but-churn-30-faster-revenuecat-finds/ and https://revenuecat.com/state-of-subscription-apps-2025
- California SB 243 summary: https://www.skadden.com/insights/publications/2025/10/new-california-companion-chatbot-law and https://fpf.org/blog/understanding-the-new-wave-of-chatbot-legislation-california-sb-243-and-beyond/
- Character.AI minors policy change: https://techcrunch.com/2025/10/29/character-ai-is-killing-the-chatbot-experience-for-minors/
- Headspace Ebb evaluation and safeguards: https://formative.jmir.org/2026/1/e86904
- Woebot shutdown and regulation: https://www.statnews.com/2025/07/02/woebot-mental-health-chatbot-shuts-down-founder-says-ai-moving-faster-than-regulators/
- Voice UX latency, turn taking, barge in: https://picovoice.ai/guide/voice-agents/voice-ux-latency-turn-taking/
- ElevenLabs API pricing: https://developer.puter.com/tutorials/elevenlabs-api-pricing/
- Anthropic pricing: https://platform.claude.com/docs/en/about-claude/pricing
- Character copyright and generative AI: https://www.dwt.com/insights/2026/04/character-copyright-protection-generative-ai
- Negotiation critique of on-screen tactics: https://www.blackswanltd.com/newsletter/negotiation-strategies-harvey-specter-gets-wrong
- Tele-MANAS helpline: https://iitk.ac.in/counsel/TeleManas.php
