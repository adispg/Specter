# Specter design system

Version 1.2 for the MVP. v1.1: founder review (modern sans system, new wordmark and icon, geometric persona marks, intensity naming fix). v1.2: design review 01 (baseline beat pause marks, single talk gesture, retention, feedback, allowance, care and privacy components). Owner: Design. Source of truth for the engineer; `mockups.html` in this folder shows every token and component in use.

This system evolves the approved prototype (`docs/prototype.html`). What the founder approved carries over: the dark premium surface, per-persona tinting, speech-synced word lighting, glowing pause marks, the pulsing avatar halo and Geist for UI. What changed in v1.1: the serif is gone (the spoken line now uses Bricolage Grotesque, a modern display sans), monograms are replaced by geometric persona marks, the brand has a new wordmark and app icon, and intensity is never shown next to a persona name. What this document adds is structure: a complete token set, named components with states, the voice choreography, and accessibility rules.

## 1. Principles

1. **The line is the product.** Every screen exists to deliver, replay, save or refine one quotable line. The line always gets the display face, the most space and the highest contrast.
2. **Silence is designed.** Pauses are content, not gaps. They are visible (glowing marks), audible (breaks) and timed per persona.
3. **One persona, one room.** The whole app re-tints to the active persona through three tokens. Components never hard-code persona colours.
4. **Calm by default, alive when speaking.** Motion only happens when a voice is listening or talking. Idle screens are still.
5. **Swap-ready.** Names, persona marks, colours, labels and voice settings come from one persona config. No persona name or colour appears in component code or CSS selectors outside the generated theme block.
6. **No likenesses.** Personas are abstract geometric marks and colour only. Never photos, illustrations, silhouettes or initials styled to evoke an actor.

## 2. Colour

Dark theme only for v1 (`color-scheme: dark`). The app root always paints `--bg` so there is never a white flash.

### 2.1 Neutrals

| Token | Value | Use |
|---|---|---|
| `--bg` | `#090c12` | App background, status bar, behind sheets |
| `--bg-raise` | `#0d1119` | Top of the background gradient |
| `--surface` | `#121722` | Cards, composer, list groups, sheet |
| `--surface-2` | `#19202e` | Line card gradient top, inputs, segmented track, mic button |
| `--surface-3` | `#212a3b` | Pressed state of surfaces, skeleton highlight |
| `--hair` | `rgba(255,255,255,0.08)` | Default 1px borders and dividers |
| `--hair-2` | `rgba(255,255,255,0.14)` | Emphasised borders, chips, inputs |
| `--fg` | `#eef1f6` | Primary text, the line |
| `--fg-2` | `#cfd5df` | Two-liner and long body copy |
| `--muted` | `#8b95a7` | Secondary text, labels, meta |
| `--dim` | `rgba(238,241,246,0.26)` | Resting pause marks, disabled icons |
| `--scrim` | `rgba(0,0,0,0.5)` | Behind sheets and dialogs |
| `--toast-bg` | `#f2f4f8` | Toast background (inverted) |
| `--toast-fg` | `#0b0f16` | Toast text |

### 2.2 Persona tint

Every component reads only these slots. The active persona sets them on the app root, and any subtree can re-tint itself (for example a Mike reply inside a Harvey thread) by setting the same variables on its own element.

| Slot | Meaning |
|---|---|
| `--accent` | Light tint: primary buttons, eyebrow labels, lit pause marks, halo ring, focus ring |
| `--accent-2` | Deep tint: listening state, the Avoid card, active waveform during input |
| `--accent-2-text` | `--accent-2` adjusted for small text contrast (only differs for Donna) |
| `--glow` | Translucent tint for the top-of-screen radial glow and voice mode wash |
| `--on-accent` | Text and icon colour on `--accent` and `--accent-2` fills |
| `--av-from`, `--av-to` | Avatar radial gradient stops |

| Persona (config id) | `--accent` | `--accent-2` | `--accent-2-text` | `--glow` | `--av-from` | `--av-to` |
|---|---|---|---|---|---|---|
| Harvey (`harvey`): midnight blue and platinum | `#d3dbe8` | `#7d9bcb` | `#7d9bcb` | `rgba(88,128,198,0.34)` | `#6f89b6` | `#1c2740` |
| Mike (`mike`): warm gold | `#ead3a6` | `#c9995a` | `#c9995a` | `rgba(201,150,80,0.28)` | `#c9a46a` | `#3b2b17` |
| Donna (`donna`): wine and rose | `#f2b6a4` | `#cf5670` | `#e07a90` | `rgba(205,72,104,0.32)` | `#e0788c` | `#4a1422` |
| Neutral (`neutral`): safety mode, system screens | `#e6e9ee` | `#9aa5b5` | `#9aa5b5` | `rgba(160,170,190,0.16)` | `#5b6474` | `#1b2029` |

`--on-accent` is `#0b0f16` for all four.

The neutral tint is used when the safety response drops the persona (see screens.md, consult result) and on splash, sign in and onboarding step 1 before a persona is chosen.

### 2.3 Semantic

| Token | Value | Use |
|---|---|---|
| `--danger` | `#e58a8a` | Errors, destructive actions, delete account |
| `--danger-bg` | `rgba(229,138,138,0.10)` | Error banner fill |
| `--warning` | `#e8c27a` | Offline banner icon, usage nearly spent |
| `--warning-bg` | `rgba(232,194,122,0.10)` | Offline banner fill |
| `--success` | `#8fd1a8` | Saved, copied, link sent confirmations |
| `--success-bg` | `rgba(143,209,168,0.10)` | Confirmation fill |
| `--info` | `var(--accent)` | Neutral information uses the persona tint |

Semantic colours never replace persona tint for brand moments. They appear only in banners, field errors, icons in toasts and destructive buttons.

### 2.4 Background recipe

The app background is the prototype's two-layer recipe and transitions over 600ms when the persona changes:

```css
background:
  radial-gradient(120% 55% at 50% -8%, var(--glow), transparent 62%),
  linear-gradient(180deg, var(--bg-raise) 0%, var(--bg) 46%);
```

Voice mode uses a stronger wash: `radial-gradient(90% 60% at 50% 38%, var(--glow), transparent 70%)` over `--bg`.

## 3. Typography

### 3.1 The faces and why

| Role | Face | Source |
|---|---|---|
| Display: the spoken line, headings, persona names, the wordmark | **Bricolage Grotesque** (variable: optical size 12 to 96, weight 200 to 800) | Google Fonts, `next/font/google` `Bricolage_Grotesque` with `axes: ["opsz"]` |
| UI: everything the app says (buttons, body, transcript, labels) | **Geist** (400, 500, 600, 700) | Google Fonts, `Geist` |
| Numbers only: billing meta, timestamps, countdown, slider values, version | **Geist Mono** (400, 500) | Google Fonts, `Geist_Mono` |

Why Bricolage Grotesque:
- **It reads as now.** It is a contemporary grotesque with real attitude: slightly condensed at display sizes, ink traps and a confident, punchy rhythm. It shows up across current consumer and creator brands, so it reads native to a Gen Z audience. At weight 600 with tight tracking it is still clean and grown-up enough for 30 to 40 year old professionals. It feels like a confident caption, not a book quote.
- **It is built for this job.** The optical size axis lets one family work at every size. At 34px in voice mode it is sharp and expressive (opsz near 34); at 15px in a list row it relaxes into a calm, open text face. `font-optical-sizing: auto` handles this, so no extra files are needed.
- **It is narrow enough for a phone.** More words fit per line at 28 to 34px, so most lines stay within two or three lines. That matters for word lighting, where line breaks interrupt the reading flow.
- **It pairs with Geist without fighting it.** Geist (the face the founder liked in the voice transcript) stays the app's voice. Bricolage is the persona's voice. The contrast is enough to tell them apart and close enough to feel like one system.
- Rejected: Space Grotesk and Inter (excluded by the founder, and Inter is ubiquitous). Plus Jakarta Sans and Manrope are friendly but read soft and corporate at display sizes. Onest and Hanken Grotesk are clean but lack personality for a quotable line. Geist at 800 was the runner-up, but it makes the persona sound like the UI.

Rule: **Bricolage is the persona speaking and the brand. Geist is the app talking. Mono is for numbers.** No serif anywhere in the product.

### 3.2 Scale

| Token | Family | Size / line height | Weight | Tracking | Use |
|---|---|---|---|---|---|
| `display-voice` | Bricolage | 34 / 1.10 | 600 | -0.025em | The line in voice mode |
| `display-line` | Bricolage | 28 / 1.14 | 600 | -0.022em | The line on the line card (`text-wrap: balance`) |
| `display-hero` | Bricolage | 32 / 1.08 | 700 | -0.03em | Onboarding, sign in, limit and empty state headlines |
| `title-1` | Bricolage | 26 / 1.12 | 700 | -0.025em | Persona full name on hero, screen titles (Cases, Saved) |
| `title-2` | Bricolage | 21 / 1.20 | 650 | -0.015em | Sheet titles, result hero name, thinking copy (22 / 600) |
| `title-3` | Bricolage | 18 / 1.30 | 600 | -0.01em | Saved line cards, thread lines (19px there), persona cards |
| `excerpt` | Bricolage | 14.5 / 1.35 | 500 | -0.005em | Line excerpts in case rows |
| `transcript` | Geist | 20 / 1.40 | 400 | -0.01em | Live transcript in voice mode (founder approved, one step smaller than v1.0) |
| `body-lg` | Geist | 16 / 1.55 | 400 | 0 | Two-liner, onboarding body |
| `body` | Geist | 15 / 1.50 | 400 | 0 | Default UI text (inputs use 16 to stop iOS zoom) |
| `body-strong` | Geist | 15 / 1.40 | 500 | 0 | List row titles, buttons |
| `section` | Geist | 13 / 1.30 | 600 | -0.005em | Section headers and field labels, sentence case ("Recent cases") |
| `small` | Geist | 13 / 1.45 | 400 | 0 | Secondary text, situation echo, hints |
| `overline` | Geist | 11 / 1.30 | 600 | 0.08em, uppercase | Principle eyebrow, card headings, voice state label (0.16em there), tags |
| `tab` | Geist | 11 / 1 | 600 | 0 | Tab bar labels, sentence case |
| `fine` | Geist | 11.5 / 1.50 | 400 | 0 | Disclaimers |
| `meta` | Geist Mono | 11 / 1.2 | 400 | 0, `tabular-nums` | Billing meta, timestamps, countdown, values |

Sizes are listed in px for readability; the tokens ship in rem (px / 16) so they follow the user's text size setting (see section 8).

Rules: uppercase is limited to `overline` (short strings only). Section headers are sentence case. Mono never sets words, except the billing meta line, which reads like a timesheet entry. Display tracking tightens as size grows; never track Bricolage positive. There is no italic; emphasis inside a line uses weight 700, never italic or colour.

## 4. Spacing, layout, radii, elevation

### 4.1 Spacing

4pt base with the prototype's in-between steps.

| Token | px | Typical use |
|---|---|---|
| `space-0.5` | 2 | Hairline offsets |
| `space-1` | 4 | Icon to label inside chips |
| `space-1.5` | 6 | Chip gaps, rail gaps |
| `space-2` | 8 | Button gaps, dock padding |
| `space-2.5` | 10 | Card stack gap |
| `space-3` | 12 | Player divider padding |
| `space-3.5` | 14 | Card inner vertical padding |
| `space-4` | 16 | Screen side gutter (min, plus safe area), card inner horizontal |
| `space-5` | 20 | Line card horizontal padding, sheet padding |
| `space-6` | 24 | Section gaps |
| `space-8` | 32 | Large section gaps |
| `space-10` | 40 | Empty state top padding |
| `space-14` | 56 | Voice mode vertical rhythm |

Layout: max content width 440px, centred; side gutter `max(16px, env(safe-area-inset-*))`. Top bar 52px. Tab bar 56px plus bottom safe area. Dock sits above the tab bar or replaces it on full-screen flows.

### 4.2 Radii

| Token | px | Use |
|---|---|---|
| `radius-xs` | 6 | Focus ring rounding, small tags |
| `radius-sm` | 9 | Segmented control thumb |
| `radius-md` | 12 | Inputs, select, segmented track, toast |
| `radius-lg` | 16 | Cards, list groups |
| `radius-xl` | 22 | Line card |
| `radius-2xl` | 26 | Composer |
| `radius-sheet` | 24 | Sheet top corners |
| `radius-pill` | 999 | Chips, buttons, avatars |

### 4.3 Elevation

Elevation on a dark UI comes mostly from lighter surfaces and hairlines; shadows are reserved for floating layers.

| Token | Value | Use |
|---|---|---|
| `shadow-0` | none, 1px `--hair` border | Cards, list groups |
| `shadow-1` | `inset 0 1px 0 rgba(255,255,255,0.04)` | Line card, composer top highlight |
| `shadow-2` | `0 10px 30px rgba(0,0,0,0.4)` | Toast, floating talk button |
| `shadow-3` | `0 -20px 60px -20px rgba(0,0,0,0.7)` | Sheet |
| `shadow-glow` | `0 0 12px var(--accent)` | Lit pause marks, active talk button ring |

## 5. Motion

| Token | Duration | Use |
|---|---|---|
| `dur-instant` | 120ms | Press feedback, toggles |
| `dur-word` | 180ms | Word lighting colour/opacity change |
| `dur-pause` | 200ms | Pause mark glow on and off, beat label |
| `dur-base` | 240ms | Chips, buttons, rows, fades |
| `dur-sheet` | 320ms | Sheet and voice mode enter |
| `dur-slow` | 400ms | Screen transitions |
| `dur-tint` | 600ms | Persona re-tint of background and accents |
| `loop-halo` | 1600ms | Speaking halo pulse |
| `loop-mic` | 1200ms | Listening halo pulse |
| `loop-wave` | 900ms | Synthetic waveform bars |
| `loop-dots` | 1200ms | Thinking dots |
| `rotate-thinking` | 2400ms | Thinking copy rotation |

| Easing token | Curve | Use |
|---|---|---|
| `ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Most transitions |
| `ease-enter` | `cubic-bezier(0.16, 1, 0.3, 1)` | Sheets, voice mode, toasts appearing |
| `ease-exit` | `cubic-bezier(0.4, 0, 1, 1)` | Dismissals |
| `ease-out` | `ease-out` | Halo rings (matches prototype) |
| `ease-in-out` | `ease-in-out` | Waveform and dots loops |

Exit transitions run at 75% of the enter duration.

## 6. Components

Sizes are visual sizes. Every interactive element has a hit area of at least 44 by 44px; where the visual is smaller, extend it with padding or a transparent `::before` inset.

### 6.1 Persona avatar and mark

A circle with a radial gradient (`radial-gradient(circle at 30% 25%, var(--av-from), var(--av-to) 72%)`), a 1px inner highlight (`inset 0 0 0 1px rgba(255,255,255,0.10)`) and the persona's **geometric mark** in white, centred at 50% of the diameter (58% at xs), with a soft `drop-shadow(0 1px 2px rgba(0,0,0,0.25))`. Marks are drawn on a 24px grid and come from config (`glyph`), so a replacement character brings its own mark.

| Persona | Mark | Character |
|---|---|---|
| Harvey | A bold upward chevron with a sharp apex over a small diamond | Angular and sharp: ascent, the closer's edge |
| Mike | A 3 by 3 grid of rounded squares, one fully lit, the rest at 50% | Precise and grid-like: the detail he found |
| Donna | Two flowing waves with round caps, the second at 55% | Warm and fluid: reading the room |
| Neutral | The beat (the brand's pause bar) | System screens and safety |

Exports in `docs/design/brand/`: `persona-harvey.svg`, `persona-mike.svg`, `persona-donna.svg` (full avatar on gradient, 256 grid) and `glyph-*.svg` (white mark only, 24 grid, for the config and React components).

| Size | Diameter | Mark | Use |
|---|---|---|---|
| xs | 20 | 12 | Thread dividers, saved line footer, filter chips |
| sm | 28 | 14 | Chips such as Ask Mike, voice mode persona chip |
| md | 36 | 18 | List rows, settings voice rows |
| lg | 46 | 23 | Persona rail, onboarding cards |
| xl | 64 | 32 | Result hero, limit screen (88 there) |
| 2xl | 120 | 60 | Voice mode (96 while speaking) |

Initials fallback: where an SVG cannot render (plain-text exports, notifications), use the short name in text, not initials.

States:
- **Resting**: as above.
- **Selected** (rail): scale 1.06, ring `0 0 0 2px var(--bg), 0 0 0 3px var(--accent)`.
- **Unselected** (rail): opacity 0.55.
- **Speaking**: halo, a 1px `--accent` ring at inset -10px (about -10% of diameter), animating scale 0.92 to 1.28 and opacity 0.7 to 0 over 1600ms ease-out, infinite. In voice mode use two staggered rings (second delayed 800ms).
- **Listening**: halo in `--accent-2`, 1200ms.
- **Pausing**: halo holds at scale 1.0, opacity 0.5, and gains `shadow-glow`.

Avatars are `aria-hidden`; the adjacent name carries meaning.

### 6.2 Persona rail

Three equal columns, gap 8, padding 8 top and 4 bottom. Each item: avatar lg over name (`small`, 12px, 500). Implemented as `role="tablist"` with `role="tab"` buttons and `aria-selected`. Selected item text `--fg`, others `--muted`. Tapping switches persona and re-tints the app over 600ms. Long press (500ms) opens the persona sheet with name, role line and "How they think" bullets from config. If a voice is speaking, switching stops it first.

### 6.3 Composer with mic

Container: `--surface`, 1px `--hair-2`, radius 26, padding 6, flex row aligned to bottom. Children: mic button (40 visual, `--surface-2`), auto-growing textarea (16px, max 120px tall, placeholder `--muted`), send button (40, `--accent` fill, arrow icon in `--on-accent`).

States:
- **Empty**: send disabled at 35% opacity.
- **Typing**: send enabled.
- **Listening**: mic fills `--accent-2` with `--on-accent` icon and a pulsing ring; text area shows live transcript; a `small` line in `--accent-2-text` under the composer reads "Listening. Tap the mic to finish."
- **Busy**: send replaced by a stop square; textarea read-only.
- **Offline**: placeholder becomes "You're offline. Type now, send when you're back." and send stays disabled.

Placeholders from config: "Tell {short} what's going on" before a case, "Push back, or tell {short} what happened next" after. Enter sends on desktop; on touch devices Enter inserts a newline.

### 6.4 Talk button

The home screen's primary action and the voice mode control.

- Visual: 132px outer ring (1px `--hair-2`), 108px inner disc filled with `linear-gradient(160deg, var(--accent), color-mix(in srgb, var(--accent-2) 70%, var(--accent)))`, mic icon 32px in `--on-accent`. Outer soft glow `0 0 60px -10px var(--glow)`.
- Label under it: `body-strong` "Tap to talk to {short}" with `small` muted sub-label "Tap again when you're done. Or type instead." ("type instead" is an inline text link in `--accent`). Below that, 12px gap, the intensity control (6.16).
- Interaction (one gesture everywhere): tap to start listening, tap again to finish, or stop talking and the turn ends after a silence (starting threshold 1.6s, tuned in build). There is no hold or push-to-talk gesture in the MVP. Haptic light impact on start (where supported). The first ever tap opens the mic priming sheet before the OS prompt.
- States: idle; pressed (scale 0.96, 120ms); listening (inner disc becomes `--accent-2`, icon becomes a stop square, two rings pulse in `--accent-2`); disabled at limit (inner disc `--surface-2`, icon `--dim`, label "Back at midnight"); offline (same as disabled, label "Voice needs a connection").
- In voice mode the control is 76px with the same states.

### 6.5 Line card (word sync and pause marks)

The prototype's `.take` card, now a named component.

- Container: radius 22, padding 22 / 20 / 16, `linear-gradient(160deg, var(--surface-2), var(--surface) 60%)`, `--hair` border, `shadow-1`.
- Slots, in order: eyebrow (principle, `overline` in `--accent`), the line (`display-line`), the two-liner (`body-lg`, `--fg-2`), player row (see 6.6), optional save icon button top right (bookmark, 44px hit area).
- **Markup source**: the model returns text with `|` (beat) and `||` (long pause). The renderer splits on pause marks into segments, then into words. Each word is a `span.w`; each mark becomes `span.pause[data-len=short|long]` holding one beat (`|`) or two beats (`||`).
- **Beat mark (v1.2)**: a mark must never read as punctuation, so there are no bars. Each beat is a dot-sized rounded pill, 0.22em wide by 0.13em tall (slightly wider than tall, so it is not a full stop), sitting on the text baseline (an `inline-flex` box aligned to the baseline). One pill means a beat, two pills (0.16em apart) mean a long pause. Wider pills were tested and rejected because a pair read as underscores. The mark has 0.34em of space on each side and rests in `--dim`, a deliberately low-contrast colour, so at rest it reads as rhythm rather than a character. It echoes the brand beat in the wordmark. Checked in a sentence at every size: `display-voice`, `display-line`, `title-3`, `body-lg`.
- **Where marks appear**: only in spoken surfaces (voice mode, line cards, thread replies, the onboarding demo). Saved lines, case excerpts, copied text, shares and notifications strip them.
- **No orphan marks**: a pause mark must never start a line. Wrap the word before each mark and the mark itself in a `white-space: nowrap` span.
- **Performing** (card has `.performing`): unspoken words drop to opacity 0.34 (raised from the prototype's 0.26 for legibility, 2.9:1); spoken words get `.lit` at opacity 1. Transition `dur-word` `ease-standard`. Words stay lit after they are spoken so the reader can see progress.
- **Pausing**: the current pause mark gets `.on`: its pills turn `--accent` with a `0 0 0.4em var(--accent)` glow, transition 200ms. The player's beat label ("Pause") fades in.
- **Done**: `.performing` is removed; all words return to full opacity over 240ms.
- **Timing source**, in priority order: (1) ElevenLabs character alignment returned with the audio, mapped to word start times; (2) `speechSynthesis` `onboundary` word events; (3) an estimate of 160 words per minute times the pace setting. Pause durations come from persona config (`gaps.short`, `gaps.long`; defaults Harvey 420/1050ms, Mike 300/700ms, Donna 360/900ms) and are also sent to TTS as `<break time="..."/>`.
- **Accessibility**: the word spans are `aria-hidden="true"`; a visually hidden sibling holds the plain text without marks, so screen readers read the line once, cleanly.

### 6.6 Waveform and player

- **Mini player** (inside the line card): top hairline, padding-top 12. Play button 40 (`--accent` fill, play or stop glyph), 7-bar waveform (3px bars, gap 3, height 4 to 20, `--accent`), beat label, meta right aligned (`meta`, `--muted`, from config: "0.3 hrs billed", "0.4 hrs, billed to Harvey", "Donna doesn't bill").
- **Voice waveform** (voice mode): 28 bars, 3px wide, gap 4, max height 48.
  - Listening: bar heights follow microphone RMS from an `AnalyserNode`, colour `--accent-2`.
  - Speaking with ElevenLabs audio: driven by an analyser on the audio element, colour `--accent`.
  - Speaking with `speechSynthesis` (no analyser): synthetic loop, 900ms ease-in-out with staggered delays.
  - Pausing: the bars fade out and two glowing beats (8 by 4px pills in `--accent`, 6px apart) hold in the centre, echoing the mark in the text. A short beat shows one.
  - Idle and reduced motion: flat 4px bars at 50% opacity.

### 6.7 Cards

- **Base card**: `--surface`, `--hair` border, radius 16, padding 14 / 16. Heading: `overline` in `--muted`, margin-bottom 6.
- **Read card**: paragraph, `body`.
- **Play card**: ordered list, markers in Geist Mono 12px `--accent` (numbers), item gap 7.
- **Avoid card**: border `color-mix(in srgb, var(--accent-2) 45%, transparent)`, heading in `--accent-2-text`.
- Headings come from persona config (Harvey: The read, The play, Avoid. Mike: The precedent, The angle, Watch out. Donna: What's really going on, What you do, What you don't). Avoid sentences never start with "Don't" (persona spec rule), so a heading never stutters.
- **Saved line card**: radius 16, a 2px left inner bar in the line's persona `--accent-2`, top-left glow `radial-gradient(80% 120% at 0% 0%, var(--glow), transparent 60%)`, line in `title-3` as plain text with marks stripped, footer with xs avatar, persona short name, date and icon actions (play, copy, overflow with Share, Open case, Remove). Swipe left reveals a 72px `--danger` Remove action; removal shows an Undo toast for 4s.
- **Banner**: radius 12, 1px border in the semantic colour at 30%, matching `-bg` fill, icon 16, `small` text, optional text action on the right.

### 6.8 Chips

Height 32 visual (44 hit area), radius pill, `small` 12.5px.
- **Situation chip**: transparent, `--hair-2` border, text `#c9cfda`. Tap prefills the composer (or starts voice with the situation preloaded in voice mode).
- **Filter chip**: same, selected state is `--fg` fill with `--bg` text (mirrors the segmented control).
- **Persona chip** (Ask Mike): sm avatar plus label, `--surface` fill, that persona's `--accent` as text colour (the chip sets its own persona variables).

### 6.9 Buttons

| Variant | Visual | Use |
|---|---|---|
| Primary | `--accent` fill, `--on-accent` text, pill, 52 tall (full width) or 40 (inline) | One per screen: Continue, Send link, Ask |
| Secondary | `--surface` fill, `--hair` border, `--fg` text | Another take, Replay, Copy |
| Ghost | transparent, `--hair-2` border | Stop, Cancel, Not now |
| Text | no fill, `--accent` text, 44 tall | See all, Resend |
| Destructive | transparent, `--danger` text, border `--danger` at 40% | Delete account, Delete case |
| Icon | 36 visual circle, `--surface`, `--hair` border, 16 icon, 44 hit area | Settings, back, close |
| Google | `#ffffff` fill, `#1f1f1f` text, Google G mark, 52 tall | Continue with Google (follows Google branding rules) |

States for all: pressed (scale 0.97 and surface one step lighter, 120ms), disabled (opacity 0.4, no pointer), loading (label replaced by three dots in current text colour, width locked), focus-visible (2px `--accent` outline, offset 2).

Icons: 24px grid, 1.8 stroke, round caps (lucide-react matches the prototype's style).

### 6.10 Inputs

- **Text field**: 52 tall, `--surface-2`, 1px `--hair-2`, radius 12, padding 0 14, text 16px. Label above in `section` style, `--muted`. Focus: border `--accent`, plus 3px ring `color-mix(in srgb, var(--accent) 25%, transparent)`. Error: border `--danger`, helper text below in `--danger` (`small`). Helper text otherwise `--muted`.
- **Select**: same box with a chevron; opens the native picker.
- **Segmented control**: track `--surface-2` radius 12 padding 3; options radius 9, 13px 500 `--muted`; selected `--fg` fill, `--bg` text.
- **Slider**: track 4px `--surface-3`, filled part `--accent`, thumb 22px `--fg` with `shadow-2`; value shown in mono at right ("1.0x").
- **Switch**: 51 by 31, track `--surface-3` off, `--accent` on, thumb `--fg` off and `--on-accent` on.

### 6.11 List rows

Min height 64, padding 12 / 16, inside a list group (`--surface`, radius 16, hairline dividers inset 16 from the left, or 64 when rows have avatars).
- Leading: md avatar or 20px icon.
- Body: title `body-strong`; subtitle either `small` `--muted` or, for case rows, the line excerpt in `excerpt` (Bricolage 500) `--fg-2`, one line, ellipsis.
- Trailing: `meta` timestamp and a 16px chevron in `--muted`, or a control (switch, value).
- Pressed: background `--surface-2`. Swipe left reveals Delete (case history) or Unsave (saved lines) in `--danger`.
- Settings rows are 52 tall with label left and value or control right.

### 6.12 Sheet

Bottom sheet, `--surface`, top border `--hair-2`, top radius 24, padding 10 / 20 / 22 plus safe area, `shadow-3`, max height 85%, content scrolls. Grab handle 38 by 4, `--hair-2`. Title in `title-2`. Enter: translateY(100%) to 0 over 320ms `ease-enter`, scrim fades in to `--scrim`. Dismiss by drag down past 30%, tapping the scrim or Escape. Focus is trapped inside; focus returns to the trigger on close. Used for: persona sheet, delivery settings shortcut, Ask another persona, delete confirmation, share.

### 6.13 Toast

Inverted pill (radius 12, `--toast-bg`, `--toast-fg`, 13px, padding 9 / 14, `shadow-2`), centred, 16px above the dock or tab bar. Optional 16px leading icon in a semantic colour and an optional text action. Duration 2600ms, 4000ms with an action. `role="status"`. Enter: fade and rise 8px over 240ms `ease-enter`. Only one toast at a time; a new one replaces the old.

### 6.14 Top bar and tab bar

- **Top bar**: 52 tall. Left: the SVG wordmark at 18px tall (home) or back icon button. Centre (detail screens): title in `body-strong` or case matter. Right: icon buttons, and on Home, Cases and Saved the profile button (6.17).
- **Tab bar**: three tabs, Consult, Cases, Saved. 56 tall plus safe area, `--bg` at 85% with 20px backdrop blur, top `--hair`. Icon 22 over a `tab` label (Geist 11/600, sentence case); active tab `--fg` with a 2px `--accent` dot above the icon, inactive `--muted`. Hidden in voice mode, onboarding, sign in and the consult flow while a reply is speaking.

### 6.15 Skeletons, empty and error blocks

- **Skeleton**: `--surface-2` blocks with a 1.4s shimmer to `--surface-3` (static under reduced motion). Shapes match final content (avatar circle, two text bars).
- **Empty state**: centred block, 40 top padding, xl avatar of the current persona or a 40px line icon, headline in `title-2`, one `small` line in `--muted`, one primary or secondary button. Headlines can be persona-flavoured but come from config.
- **Inline error**: banner (6.7) with a Retry text action.

### 6.16 Intensity control

Intensity (Measured, Sharp, No mercy) is a setting, not part of a persona's name, so it never sits inside or directly beside a persona chip, and it is always labelled with the word "Intensity".

- Visual: pill 32 tall (44 hit area), `--surface-2`, 1px `--hair-2`. Leading dial icon 15px in `--accent`, then "Intensity:" in `--muted` 12.5px, then the value in `--fg` 600. Reads "Intensity: Sharp" visually and to screen readers (`aria-label="Intensity: Sharp. Double tap to change."`).
- Placement: home, centred under the talk button label. Voice mode, centred between the waveform and the hint while listening; hidden while thinking and speaking (changing it mid-reply has no effect). Settings, as a segmented control titled "Intensity" with the dial icon. It never appears in the composer, the persona rail, the voice mode persona chip or case rows.
- Interaction: tap opens a small sheet with the three levels and one-line descriptions ("Measured: direct, warmer underneath." "Sharp: the full character." "No mercy: the hard truth, no cushioning."). Selection shows a toast "Intensity: No mercy".
- Spacing: at least 12px from any persona name or chip.

### 6.17 Profile button

A 36px circle (44 hit area) that opens Settings. Signed in: the user's initial in Geist 600 15px on `--surface-2` with a 1px `--hair-2` ring. Guest: a person icon on the same circle, with a "Sign in" text button (13px, `--accent`) to its left on Home only. Replaces the v1.1 sliders icon, which read as a filter next to search.

### 6.18 Moment row ("When is it happening?")

A borderless row under the line card on the first result: 16px clock icon in `--muted`, `small` "When is it happening?", then a scrolling chip row (Today, Tomorrow, This week, Pick a time). Pick a time opens the native date and time picker. Once set, the row collapses to `small` "Happening Tomorrow, 10:00" in `--fg-2` with a text button "Change". In the thread it is pinned under the top bar.

### 6.19 Debrief card

Persona-tinted card (`--surface` with the persona glow at top left, `--hair` border, radius 16, padding 14 16). Header row: xs avatar, `overline` "Debrief" in `--accent`, and a close icon (dismiss, asks again next open, then stops). Title `title-3` "How did it go with {matter}?". Three equal chips: "Used it", "Partly", "Didn't". Text button "Add a note" opens the thread with the composer focused. On Home it sits between the talk control and quick situations; in the thread it replaces the moment row. Case rows show an outlined `overline` "Debrief" tag (accent at 50%) until answered.

### 6.20 Feedback row and sheet

End of the result cards and inside "Show more" in the thread: `small` "Was this useful?" left, two 36px icon buttons (thumbs up, thumbs down, 44 hit area) right. Selected thumb fills `--accent` with `--on-accent` icon. Thumbs down opens a sheet: `title-2` "What missed?", single-choice chips (Too long, Off target, Not their voice, Unsafe, Other), optional note field, primary "Send".

### 6.21 Account sheet ("Keep this case?")

A bottom sheet (6.12) with a mini case summary row (xs avatar, matter in `body-strong`), `title-2` headline, `body` reason line, Google button, secondary "Continue with email" (expands an inline email field and "Send me a link"), ghost "Not now" (omitted when sign in is required).

### 6.22 Plan card (paywall stub)

Radius 16, `--surface`, 1px `--hair`, padding 16. Left: plan name `body-strong`, price in Bricolage 650 20px, equivalent in `small` muted. Right: 22px radio. Selected: border `--accent`, 1px outer ring, radio filled. Optional tag pill top right ("Best value", `overline`, `--accent` on `color-mix(in srgb, var(--accent) 14%, transparent)`). Annual first, monthly second.

### 6.23 Helpline button (care mode)

Full-width 56px button, `--accent` fill (neutral tint, so platinum), phone icon, two-line label: helpline name in Geist 600 15px ("Call Tele-MANAS") and the number in Geist Mono 13px ("14416"). Secondary emergency button uses the secondary style with the same two-line layout. Values come from region config (`helplines[country] = { name, number, sms?, emergencyNumber, directoryUrl }`).

### 6.24 Chip row overflow

Single-row chip scrollers end with a 32px fade (`linear-gradient(to right, transparent, var(--bg))` masked over the trailing edge) so clipped chips read as scrollable. Fade hides when scrolled to the end.

## 7. Voice-state choreography

One state machine drives the home talk button, the voice mode screen and the line card. States: `idle`, `listening`, `thinking`, `speaking`, `pausing` (a sub-state of speaking), `interrupted`. Transitions are listed with what every element does.

| State | Avatar | Waveform | Text area | Control | Live region | Haptic |
|---|---|---|---|---|---|---|
| idle | Static, no halo | Flat, 50% | Last line or prompt | Mic icon, label "Tap to talk" | none | none |
| listening | Halo in `--accent-2`, 1200ms | Mic RMS, `--accent-2` | Live transcript (Geist 20) | Stop square, label "Tap to finish" | polite: "Listening" once | light on start |
| thinking | Halo off, avatar breathes (scale 1 to 1.03, 2400ms) | Collapsed, dots | Rotating persona thinking copy in `title-2` (Bricolage 600) | Ghost Stop | polite: "{short} is thinking" | none |
| speaking | Halo in `--accent`, 1600ms, double ring in voice mode | Audio or synthetic, `--accent` | The line with word lighting, captions always on | Ghost "Tap to interrupt" hint, pause/stop | off (no announcements over speech) | soft on first word |
| pausing | Halo holds at 1.0, glow on | Collapses to glowing line | Current pause mark glows, beat label shows | unchanged | off | none |
| interrupted | Halo stops instantly | Snaps to idle | Unspoken words remain dim, spoken stay lit | Switches to listening after 250ms | polite: "Stopped. Go ahead." | medium |

### 7.1 Transitions

- **idle to listening**: tap the talk button or mic. Voice mode slides up (320ms `ease-enter`); the avatar scales from its home position to 120px. The microphone opens before the animation ends so the first syllable is not lost. If permission is missing, go to the permission prompt (screens.md, onboarding 3) instead.
- **listening**: interim words render in `--muted`, final words in `--fg`, both in `transcript` style, auto-scrolling to keep the last line visible. End of turn: tap the control again, or a silence (1.6s to start) after at least 8 characters. Under 8 characters: toast "Give them a little more than that." and stay in listening.
- **listening to thinking**: the transcript shrinks into a "You" echo line at the top (240ms), the avatar halo stops, dots appear. Thinking copy rotates every 2400ms from config. Stop returns to idle with the transcript kept in the composer.
- **thinking to speaking**: the line types in nothing; it appears fully, dimmed to 0.34 (performing), then the first word lights when audio starts. Audio and lighting must start together; buffer at least the first segment before showing the speaking state.
- **speaking to pausing to speaking**: at each pause mark, lighting stops, the mark glows for exactly the persona gap, then the next segment lights. Long pause after the line before the two-liner is always inserted if the model did not mark one.
- **speaking to interrupted**: a tap anywhere on the voice mode surface (except the close and type buttons), or speech detected through the mic in a later version. Audio stops within 150ms. After 250ms the state becomes listening for a push back, unless the user tapped the Stop button, which returns to idle and shows the result.
- **speaking to idle (done)**: last word lit, 600ms hold, words return to full opacity, then voice mode offers "See the full play" which opens the consult result. If "Speak replies" is off, thinking goes straight to the consult result with the player idle.

### 7.2 Errors inside the machine

- Mic denied: listening never starts; voice mode shows the mic denied state with Type instead.
- No speech detected for 8s: back to idle with toast "Didn't catch that. Try again."
- TTS fails: fall back to `speechSynthesis`; if that is unavailable, show the line fully lit (no performance) with toast "Voice unavailable. Here it is in writing."
- Network drop during thinking: thinking ends, banner "Lost the connection. Your situation is saved." with Retry.
- **Care reply**: if the reply has `mode: "care"` (or the pre-screen fires), the machine never enters speaking. Thinking cross-fades to the neutral tint over 240ms, voice mode closes and the care screen opens. With voice on, the care message plays in the neutral voice at normal pace with no beats, halo, word lighting, persona chip or intensity.
- **Follow-up replies** (interruptions and voice push backs) close voice mode onto the case thread, not the result.

## 8. Accessibility

- **Contrast** (measured on `--surface`): `--fg` 15.8:1, `--fg-2` 12.2:1, `--muted` 5.9:1, accents 10.3 to 12.9:1, `--accent-2` Harvey 6.3:1, Mike 7.0:1. Donna's `--accent-2` is 4.45:1, so small Donna text uses `--accent-2-text` `#e07a90` (6.3:1). `--on-accent` on all accent fills is at least 4.8:1. Listening fills use `--on-accent` icons (white on `--accent-2` fails for Harvey and Mike). Unlit words while performing are 2.9:1 by intent; they are a progress cue, the complete text is shown at full contrast before and after, and the visually hidden copy is always available.
- **Captions always on while speaking**: there is no setting to hide text during speech. Voice mode always shows the line with word lighting; the consult result shows the same card. Muting the device does not stop captions.
- **Reduced motion** (`prefers-reduced-motion: reduce`): no halo pulses, waveform loops, shimmer, dots or rotating thinking copy (show the first thinking line). Persona re-tint is instant. Word lighting still happens because it carries meaning, but without transitions. Pause marks still switch to `--accent` during pauses but without glow animation. Voice mode appears with a 150ms fade instead of a slide.
- **Tap targets**: 44 by 44 minimum everywhere, 8px minimum between adjacent targets.
- **Screen readers**: rail is a tablist; voice mode is a dialog (`role="dialog"`, `aria-modal="true"`, labelled "Talking to {name}"); the state label is a polite live region announcing state changes except during speech. Pause marks are hidden. Every icon button has an `aria-label`.
- **Text size**: all type tokens are defined in rem (16px root) so browser zoom and iOS Larger Text scale them. Check every screen at 200%: the line card wraps and grows without clipping, the talk label wraps to two lines rather than truncating, chip rows scroll, and tab labels may truncate before icons shrink.
- **Keyboard**: all actions reachable; Space toggles listening in voice mode; Escape closes voice mode and sheets.
- **Copy**: no em dashes or en dashes anywhere. Renderer strips any that slip through (`noDash`, as in the prototype).

## 9. Tailwind-ready CSS variables

Drop this into `app/globals.css` (Tailwind v4). Raw tokens live on `:root`; `@theme inline` maps them to utilities so that a persona override on any element re-tints its children. Persona values are written by the `PersonaTheme` component from persona config; the blocks below are the defaults so first paint is correct.

```css
@import "tailwindcss";

:root {
  color-scheme: dark;
  /* neutrals */
  --bg: #090c12; --bg-raise: #0d1119;
  --surface: #121722; --surface-2: #19202e; --surface-3: #212a3b;
  --hair: rgba(255,255,255,0.08); --hair-2: rgba(255,255,255,0.14);
  --fg: #eef1f6; --fg-2: #cfd5df; --muted: #8b95a7; --dim: rgba(238,241,246,0.26);
  --scrim: rgba(0,0,0,0.5); --toast-bg: #f2f4f8; --toast-fg: #0b0f16;
  /* semantic */
  --danger: #e58a8a; --danger-bg: rgba(229,138,138,0.10);
  --warning: #e8c27a; --warning-bg: rgba(232,194,122,0.10);
  --success: #8fd1a8; --success-bg: rgba(143,209,168,0.10);
  /* persona slots (default: harvey) */
  --accent: #d3dbe8; --accent-2: #7d9bcb; --accent-2-text: #7d9bcb;
  --glow: rgba(88,128,198,0.34); --on-accent: #0b0f16;
  --av-from: #6f89b6; --av-to: #1c2740;
  /* type families (next/font sets the --font-*-src variables) */
  --font-display-src: "Bricolage Grotesque", "Geist", "Segoe UI", -apple-system, system-ui, sans-serif;
  --font-sans-src: "Geist", "Segoe UI", -apple-system, system-ui, sans-serif;
  --font-mono-src: "Geist Mono", ui-monospace, "Cascadia Mono", Consolas, monospace;
  /* persona voice pacing (ms), mirrored from config for CSS-driven demos */
  --gap-short: 420ms; --gap-long: 1050ms;
}

/* Generated from persona config at build time; never hand-edit names here. */
[data-persona="harvey"] { --accent:#d3dbe8; --accent-2:#7d9bcb; --accent-2-text:#7d9bcb; --glow:rgba(88,128,198,0.34); --av-from:#6f89b6; --av-to:#1c2740; }
[data-persona="mike"]   { --accent:#ead3a6; --accent-2:#c9995a; --accent-2-text:#c9995a; --glow:rgba(201,150,80,0.28); --av-from:#c9a46a; --av-to:#3b2b17; }
[data-persona="donna"]  { --accent:#f2b6a4; --accent-2:#cf5670; --accent-2-text:#e07a90; --glow:rgba(205,72,104,0.32); --av-from:#e0788c; --av-to:#4a1422; }
[data-persona="neutral"]{ --accent:#e6e9ee; --accent-2:#9aa5b5; --accent-2-text:#9aa5b5; --glow:rgba(160,170,190,0.16); --av-from:#5b6474; --av-to:#1b2029; }

@theme inline {
  --color-bg: var(--bg); --color-bg-raise: var(--bg-raise);
  --color-surface: var(--surface); --color-surface-2: var(--surface-2); --color-surface-3: var(--surface-3);
  --color-hair: var(--hair); --color-hair-2: var(--hair-2);
  --color-fg: var(--fg); --color-fg-2: var(--fg-2); --color-muted: var(--muted); --color-dim: var(--dim);
  --color-accent: var(--accent); --color-accent-2: var(--accent-2); --color-accent-2-text: var(--accent-2-text);
  --color-glow: var(--glow); --color-on-accent: var(--on-accent);
  --color-danger: var(--danger); --color-danger-bg: var(--danger-bg);
  --color-warning: var(--warning); --color-warning-bg: var(--warning-bg);
  --color-success: var(--success); --color-success-bg: var(--success-bg);
  --color-toast: var(--toast-bg); --color-toast-fg: var(--toast-fg);

  --font-display: var(--font-display-src); --font-sans: var(--font-sans-src); --font-mono: var(--font-mono-src);

  --text-display-voice: 2.125rem; --text-display-voice--line-height: 1.1; --text-display-voice--letter-spacing: -0.025em; --text-display-voice--font-weight: 600;
  --text-display-line: 1.75rem;  --text-display-line--line-height: 1.14; --text-display-line--letter-spacing: -0.022em; --text-display-line--font-weight: 600;
  --text-display-hero: 2rem;  --text-display-hero--line-height: 1.08; --text-display-hero--letter-spacing: -0.03em; --text-display-hero--font-weight: 700;
  --text-title-1: 1.625rem; --text-title-1--line-height: 1.12; --text-title-1--letter-spacing: -0.025em; --text-title-1--font-weight: 700;
  --text-title-2: 1.3125rem; --text-title-2--line-height: 1.2; --text-title-2--letter-spacing: -0.015em; --text-title-2--font-weight: 650;
  --text-title-3: 1.125rem; --text-title-3--line-height: 1.3; --text-title-3--letter-spacing: -0.01em; --text-title-3--font-weight: 600;
  --text-excerpt: 0.9062rem; --text-excerpt--line-height: 1.35;
  --text-transcript: 1.25rem; --text-transcript--line-height: 1.4; --text-transcript--letter-spacing: -0.01em;
  --text-section: 0.8125rem; --text-section--line-height: 1.3; --text-section--font-weight: 600;
  --text-overline: 0.6875rem; --text-overline--line-height: 1.3; --text-overline--letter-spacing: 0.08em; --text-overline--font-weight: 600;
  --text-body-lg: 1rem; --text-body-lg--line-height: 1.55;
  --text-body: 0.9375rem; --text-body--line-height: 1.5;
  --text-small: 0.8125rem; --text-small--line-height: 1.45;
  --text-fine: 0.7188rem; --text-fine--line-height: 1.5;
  --text-meta: 0.6875rem; --text-meta--line-height: 1.2;
  --tracking-overline: 0.08em; --tracking-state: 0.16em;

  --spacing: 4px; /* p-4 = 16px, gap-2.5 = 10px, etc. */

  --radius-xs: 6px; --radius-sm: 9px; --radius-md: 12px; --radius-lg: 16px;
  --radius-xl: 22px; --radius-2xl: 26px; --radius-sheet: 24px;

  --shadow-1: inset 0 1px 0 rgba(255,255,255,0.04);
  --shadow-2: 0 10px 30px rgba(0,0,0,0.4);
  --shadow-3: 0 -20px 60px -20px rgba(0,0,0,0.7);
  --shadow-glow: 0 0 12px var(--accent);

  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --ease-enter: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-exit: cubic-bezier(0.4, 0, 1, 1);

  --animate-halo: halo 1600ms ease-out infinite;
  --animate-halo-mic: halo 1200ms ease-out infinite;
  --animate-wave: wave 900ms ease-in-out infinite;
  --animate-dot: dot 1200ms ease-in-out infinite;
  --animate-shimmer: shimmer 1400ms linear infinite;

  @keyframes halo { 0% { transform: scale(.92); opacity: .7; } 100% { transform: scale(1.28); opacity: 0; } }
  @keyframes wave { 0%, 100% { height: 4px; } 50% { height: 20px; } }
  @keyframes dot { 0%, 100% { opacity: .2; } 50% { opacity: 1; } }
  @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
}

/* motion durations as plain vars (use with duration-[var(--dur-word)]) */
:root { --dur-instant: 120ms; --dur-word: 180ms; --dur-pause: 200ms; --dur-base: 240ms; --dur-sheet: 320ms; --dur-slow: 400ms; --dur-tint: 600ms; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition-duration: 0ms !important; }
}
```

Example usage: `<article className="rounded-xl border border-hair bg-surface p-5 shadow-1">`, `<p className="font-display text-display-line text-fg">`, `<h3 className="font-sans text-overline uppercase text-muted">`, `<button className="rounded-full bg-accent text-on-accent h-10 px-4">`.

Word and pause classes stay as plain CSS (they are stateful and toggled by the speech engine):

```css
.w { transition: opacity var(--dur-word) var(--ease-standard); }
.performing .w { opacity: .34; }
.performing .w.lit { opacity: 1; }
/* <span class="pause" data-len="short"><i></i></span>  or  data-len="long" with two <i> */
.pause { display: inline-flex; gap: .16em; margin: 0 .34em; vertical-align: baseline; }
.pause i { display: block; width: .22em; height: .13em; border-radius: 1em; background: var(--dim); transition: background var(--dur-pause), box-shadow var(--dur-pause); }
.pause.on i { background: var(--accent); box-shadow: 0 0 .4em var(--accent); }
.nb { white-space: nowrap; } /* wraps the word before a mark so a mark never starts a line */
```

### 9.1 Persona config contract (design fields)

The engineer owns the config file; these are the fields design depends on. Changing personas for a commercial launch means editing only this object.

```ts
type PersonaDesign = {
  id: string;            // used in data-persona, e.g. "harvey"
  name: string;          // "Harvey Specter"
  short: string;         // "Harvey"
  glyph: string;         // SVG markup or asset path on a 24 grid, white, e.g. brand/glyph-harvey.svg
  role: string;          // overline label, one per persona: "The closer", "The prodigy", "The reader"
  tagline: string;       // the only line under the name, everywhere: "Finds the leverage.", "Finds the detail.", "Reads the people."
  theme: { accent: string; accent2: string; accent2Text: string; glow: string; avFrom: string; avTo: string; onAccent: string };
  labels: { read: string; play: string; avoid: string }; // Harvey: "The read", "The play", "Avoid"
  thinking: string[];    // rotating thinking copy
  meta: string;          // template, e.g. "{hours} hrs billed"
  gaps: { short: number; long: number }; // ms
  voiceOptions: { id: string; label: string }[]; // stock TTS voices offered in settings
  emptyStates: { home: string; cases: string; saved: string; limit: string };
};

// App-level config the screens depend on (not per persona)
type AppDesignConfig = {
  pack: "show" | "original";   // show: fan disclaimer, no paywall. original: paywall flag allowed, no fan disclaimer
  paywallEnabled: boolean;     // only honoured when pack is "original"
  allowance: { count: number; period: "day" | "week"; followUpsPerCase: number; resetWeekday?: string }; // hypothesis: 3 per week, 5 follow-ups
  helplines: Record<string, { name: string; number: string; sms?: string; emergencyNumber: string; directoryUrl: string }>;
  // e.g. IN: Tele-MANAS 14416, emergency 112; US: 988 (call or text), 911; GB: Samaritans 116 123, 999
};
```

`PersonaTheme` sets `data-persona={id}` and inline CSS variables from `theme`, so a new persona needs no CSS change.

Fonts in Next.js:

```ts
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
export const display = Bricolage_Grotesque({ subsets: ["latin"], axes: ["opsz"], variable: "--font-display-src", display: "swap" });
export const sans = Geist({ subsets: ["latin"], variable: "--font-sans-src", display: "swap" });
export const mono = Geist_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono-src", display: "swap" });
```

Set `font-optical-sizing: auto` on `html`.

## 10. Persona naming rule

One rule, applied everywhere, driven by config fields `name` (full) and `short` (first name):

- **Full name (`name`) on hero surfaces only**: home hero under the rail, consult result hero, the persona sheet, onboarding persona cards. These are the places where the persona is being introduced.
- **First name (`short`) everywhere else**: rail labels, voice mode persona chip, talk button label ("Tap to talk to Harvey"), composer placeholders, thinking line ("Harvey is on it"), Ask chips ("Ask Mike"), thread headers, dividers ("Asked Mike"), saved line footers, settings ("Harvey's voice"), CTAs ("Continue with Harvey"), toasts.
- **Never** combine a persona name with any other label in the same chip or line (no intensity, no level, no status words). The voice mode chip holds only the mark and the first name.
- **Possessives** use the short name ("Harvey's voice"). **Billing meta** is persona copy from config and may reference another persona ("billed to Harvey").
- **Never** use initials as a name in UI copy.
- **Role and tagline**: each persona has exactly one `role` (overline, onboarding cards and persona sheet) and one `tagline` (under the name on every hero and card). No screen writes its own description of a persona, so taglines never clash (Harvey "Finds the leverage.", Mike "Finds the detail.", Donna "Reads the people.").
- **Status lines** use the short name in sentence case `small`: "Harvey is on it". Never uppercase.

## 11. Brand

Files in `docs/design/brand/`:

| File | Use |
|---|---|
| `wordmark.svg` | Lowercase "specter" in Bricolage Grotesque 760 at -3.5% tracking, outlined to paths, followed by **the beat**: a rounded bar sitting on the baseline in `--accent` with a soft glow. The beat is the brand device: it is the product's pause mark, and on the baseline it reads like a live caption cursor. Text `#eef1f6` for dark backgrounds. Minimum height 16px; clear space equal to the bar width on all sides. |
| `icon.svg` | App icon (1024, rounded): the "s" and the beat on midnight, with a low aurora of the three persona tints along the bottom edge. Use for `purpose: "any"` and the favicon. |
| `icon-maskable.svg` | Same artwork full-bleed with the mark inside the central 80% safe zone, for `purpose: "maskable"` in the PWA manifest. |
| `persona-*.svg`, `glyph-*.svg` | Persona marks (see 6.1). |

In plain text (share text, emails, store listings, notifications) always write **Specter** with a capital S and never an underscore; the baseline beat exists only in the drawn wordmark.

In the app the wordmark appears only in the home top bar (18px), splash (30px) and sign in (18px). The beat's colour follows the active persona's `--accent` in the app; the static files use platinum `#d3dbe8`.
