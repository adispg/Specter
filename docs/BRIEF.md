# Specter: product brief (from the founder, via Claude)

Owner: Aditya Gupta (founder). He wants a real, end-to-end product, not a prototype.

## What Specter is
A mobile-first app (installable PWA first, native later) where a user describes a situation from their life or work, by voice or text, and gets advice from one of three personas, delivered as a quotable one-liner, a two-liner, a read on the situation, a three-step play and one thing to avoid. The reply is spoken aloud with deliberate pacing and visible pauses.

Personas (v1): Harvey Specter (the closer), Mike Ross (the prodigy associate), Donna Paulsen (the chief of staff who reads everyone). These are characters from the TV show Suits.

## Hard constraints (non-negotiable)
- Never reproduce, quote or store actual dialogue, subtitles or scripts from Suits. No subtitle downloading or scraping. Character understanding comes from public descriptions and commentary of the characters (traits, philosophy, delivery style), never from transcripts. All generated lines must be original.
- Never imitate or clone any actor's real voice. Use stock TTS voices chosen to fit the archetype (a sharp, confident, low male voice for Harvey, etc.).
- Persona names, colours and copy must live in one config so the founder can swap to original characters for a commercial launch (the show's characters belong to NBCUniversal; a paid launch under those names needs a licence).
- Advice must be legal and safe. Crisis or self-harm signals: drop the persona, respond with warmth and point to emergency help.
- No em dashes or en dashes in any user-facing copy or generated output (founder's style rule).

## Locked technical decisions
- Next.js 15 App Router + TypeScript, deployed on Vercel. Mobile-first, installable PWA (manifest + service worker).
- Supabase: Auth (email magic link + Google OAuth) and Postgres with Row Level Security. SQL migrations in `supabase/migrations`.
- LLM: Anthropic API, server-side only (`ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, default `claude-sonnet-5-5`). Structured JSON output validated with zod.
- Voice out: ElevenLabs TTS via a server route, using stock premade voices configured by env per persona; pause marks in the text ("|" beat, "||" long pause) become `<break time="..."/>` tags. Fallback to browser speechSynthesis when no key.
- Voice in: browser Web Speech API where available; fallback records audio with MediaRecorder and sends it to a server route that uses ElevenLabs speech-to-text.
- Tests: Vitest for units, Playwright for e2e with a `MOCK_AI=1` mode so tests never need real keys. A persona eval harness (situations, intents, expected outcomes, rubric, LLM judge) lives in `harness/`.
- Code lives in `/home/claude/specter`; it will be pushed to a private GitHub repo under the founder's account (`adispg`) once he creates it.

## Visual direction
The founder liked the latest prototype's UI and fonts: dark premium phone UI, Instrument Serif for the spoken line, Geist for UI, Geist Mono for small labels; each persona re-tints the app (Harvey midnight blue and platinum, Mike warm gold, Donna wine and rose); words light up as they are spoken and pause marks glow during silences; avatar halo pulses while speaking. Prototype source: `/home/claude/specter/docs/prototype.html`.

## Team
- Product manager: PRD, persona harness spec, eval set, scope, metrics. Output in `docs/`.
- Designer: design system and screen specs building on the prototype. Output in `docs/design/`.
- Engineer: implements the app, tests, pushes to GitHub.
- Tester: runs everything, writes bug reports in `docs/qa/`, verifies fixes.
