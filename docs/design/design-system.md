# Specter design system

Version 1.0 for the MVP. Owner: Design. Source of truth for the engineer; `mockups.html` in this folder shows every token and component in use.

This system evolves the approved prototype (`docs/prototype.html`). Nothing in its look is replaced: the dark premium surface, Instrument Serif for the spoken line, Geist for UI, Geist Mono for small labels, per-persona tinting, speech-synced word lighting, glowing pause marks and the pulsing avatar halo all carry over. What this document adds is structure: a complete token set, named components with states, the voice choreography, and accessibility rules.

## 1. Principles

1. **The line is the product.** Every screen exists to deliver, replay, save or refine one quotable line. The line always gets the serif, the most space and the highest contrast.
2. **Silence is designed.** Pauses are content, not gaps. They are visible (glowing marks), audible (breaks) and timed per persona.
3. **One persona, one room.** The whole app re-tints to the active persona through three tokens. Components never hard-code persona colours.
4. **Calm by default, alive when speaking.** Motion only happens when a voice is listening or talking. Idle screens are still.
5. **Swap-ready.** Names, monograms, colours, labels and voice settings come from one persona config. No persona name or colour appears in component code or CSS selectors outside the generated theme block.
6. **No likenesses.** Personas are monogram avatars and colour only. Never photos, illustrations or silhouettes of actors.

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

Fonts via `next/font/google`: `Instrument_Serif` (400, normal and italic), `Geist` (400, 500, 600), `Geist_Mono` (400, 500). Fallbacks as in the prototype.

| Token | Family | Size / line height | Weight | Tracking | Use |
|---|---|---|---|---|---|
| `display-voice` | Serif | 36 / 1.14 | 400 | -0.01em | The line in voice mode |
| `display-line` | Serif | 31 / 1.16 | 400 | -0.01em | The line on the line card (`text-wrap: balance`) |
| `title-1` | Serif | 28 / 1.05 | 400 | -0.005em | Persona name in hero, screen titles |
| `title-2` | Serif | 24 / 1.1 | 400 | 0 | Sheet titles, empty state headlines, thinking copy (italic) |
| `title-3` | Serif | 20 / 1.2 | 400 | 0 | Saved line cards, thread line previews |
| `transcript` | Sans | 22 / 1.35 | 400 | -0.005em | Live transcript in voice mode |
| `body-lg` | Sans | 16 / 1.55 | 400 | 0 | Two-liner |
| `body` | Sans | 15 / 1.5 | 400 | 0 | Default UI text, inputs (15 minimum on iOS inputs is fine; use 16 to stop zoom) |
| `body-strong` | Sans | 15 / 1.4 | 500 | 0 | List row titles, buttons |
| `small` | Sans | 13 / 1.45 | 400 | 0 | Secondary text, situation echo, hints |
| `fine` | Sans | 11.5 / 1.5 | 400 | 0 | Disclaimers |
| `label` | Mono | 10.5 / 1.3 | 500 | 0.14em, uppercase | Card headings, field labels, eyebrows (0.16em for eyebrows) |
| `meta` | Mono | 11 / 1.2 | 400 | 0 | Billing meta, timestamps |
| `wordmark` | Mono | 11 / 1 | 500 | 0.42em | SPECTER wordmark |

Rules: the serif is reserved for persona voice (lines, names, persona-authored headlines). UI chrome is always Geist. Mono is only for labels of 13px or less. Text inputs use 16px to prevent iOS zoom.

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

### 6.1 Persona avatar

A circle with a radial gradient (`radial-gradient(circle at 30% 25%, var(--av-from), var(--av-to) 72%)`) and the persona monogram in Instrument Serif, white, letter-spacing 0.02em. Monogram and colours come from config.

| Size | Diameter | Monogram | Use |
|---|---|---|---|
| xs | 20 | 9px | Inline in thread dividers, saved line footer |
| sm | 28 | 12px | Chips such as Ask Mike |
| md | 36 | 14px | List rows |
| lg | 46 | 18px | Persona rail |
| xl | 64 | 24px | Hero on home and result |
| 2xl | 120 | 44px | Voice mode |

States:
- **Resting**: as above.
- **Selected** (rail): scale 1.06, ring `0 0 0 2px var(--bg), 0 0 0 3px var(--accent)`.
- **Unselected** (rail): opacity 0.55.
- **Speaking**: halo, a 1px `--accent` ring at inset -6px (scale with size, about -10% of diameter), animating scale 0.92 to 1.28 and opacity 0.7 to 0 over 1600ms ease-out, infinite. In voice mode use two staggered rings (second delayed 800ms).
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
- **Listening**: mic fills `--accent-2` with `--on-accent` icon and a pulsing ring; text area shows live transcript; a mono `label` line under the composer reads "Listening. Tap the mic to finish."
- **Busy**: send replaced by a stop square; textarea read-only.
- **Offline**: placeholder becomes "You're offline. Type now, send when you're back." and send stays disabled.

Placeholders from config: "Tell {short} what's going on" before a case, "Push back, or tell {short} what happened next" after. Enter sends on desktop; on touch devices Enter inserts a newline.

### 6.4 Talk button

The home screen's primary action and the voice mode control.

- Visual: 132px outer ring (1px `--hair-2`), 108px inner disc filled with `linear-gradient(160deg, var(--accent), color-mix(in srgb, var(--accent-2) 70%, var(--accent)))`, mic icon 32px in `--on-accent`. Outer soft glow `0 0 60px -10px var(--glow)`.
- Label under it: `body-strong` "Tap to talk to {short}" with `small` muted sub-label "or hold to talk, release to send".
- Interaction: tap toggles into voice mode (listening). Press and hold over 350ms enters push-to-talk; release submits. Haptic light impact on start (where supported).
- States: idle; pressed (scale 0.96, 120ms); listening (inner disc becomes `--accent-2`, icon becomes a stop square, two rings pulse in `--accent-2`); disabled at limit (inner disc `--surface-2`, icon `--dim`, label "Back at midnight"); offline (same as disabled, label "Voice needs a connection").
- In voice mode the control is 76px with the same states.

### 6.5 Line card (word sync and pause marks)

The prototype's `.take` card, now a named component.

- Container: radius 22, padding 22 / 20 / 16, `linear-gradient(160deg, var(--surface-2), var(--surface) 60%)`, `--hair` border, `shadow-1`.
- Slots, in order: eyebrow (principle, mono label in `--accent`), the line (`display-line`), the two-liner (`body-lg`, `--fg-2`), player row (see 6.6), optional save icon button top right (bookmark, 44px hit area).
- **Markup source**: the model returns text with `|` (beat) and `||` (long pause). The renderer splits on pause marks into segments, then into words. Each word is a `span.w`; each mark becomes `span.pause[data-len=short|long]`, 2px tall, rounded, `--dim`; widths 0.55em (short) and 1.4em (long), margin 0 0.28em, vertically centred.
- **No orphan marks**: a pause mark must never start a line. Wrap the word before each mark and the mark itself in a `white-space: nowrap` span.
- **Performing** (card has `.performing`): unspoken words drop to opacity 0.34 (raised from the prototype's 0.26 for legibility, 2.9:1); spoken words get `.lit` at opacity 1. Transition `dur-word` `ease-standard`. Words stay lit after they are spoken so the reader can see progress.
- **Pausing**: the current pause mark gets `.on`: background `--accent`, `shadow-glow`, transition 200ms. The player's beat label ("Pause") fades in.
- **Done**: `.performing` is removed; all words return to full opacity over 240ms.
- **Timing source**, in priority order: (1) ElevenLabs character alignment returned with the audio, mapped to word start times; (2) `speechSynthesis` `onboundary` word events; (3) an estimate of 160 words per minute times the pace setting. Pause durations come from persona config (`gaps.short`, `gaps.long`; defaults Harvey 420/1050ms, Mike 300/700ms, Donna 360/900ms) and are also sent to TTS as `<break time="..."/>`.
- **Accessibility**: the word spans are `aria-hidden="true"`; a visually hidden sibling holds the plain text without marks, so screen readers read the line once, cleanly.

### 6.6 Waveform and player

- **Mini player** (inside the line card): top hairline, padding-top 12. Play button 40 (`--accent` fill, play or stop glyph), 7-bar waveform (3px bars, gap 3, height 4 to 20, `--accent`), beat label, meta right aligned (`meta`, `--muted`, from config: "0.3 hrs billed", "0.4 hrs, billed to Harvey", "Donna doesn't bill").
- **Voice waveform** (voice mode): 28 bars, 3px wide, gap 4, max height 48.
  - Listening: bar heights follow microphone RMS from an `AnalyserNode`, colour `--accent-2`.
  - Speaking with ElevenLabs audio: driven by an analyser on the audio element, colour `--accent`.
  - Speaking with `speechSynthesis` (no analyser): synthetic loop, 900ms ease-in-out with staggered delays.
  - Pausing: all bars collapse to 2px and the row becomes a single glowing line (`shadow-glow`), echoing the pause mark.
  - Idle and reduced motion: flat 4px bars at 50% opacity.

### 6.7 Cards

- **Base card**: `--surface`, `--hair` border, radius 16, padding 14 / 16. Heading: mono `label` in `--muted`, margin-bottom 6.
- **Read card**: paragraph, `body`.
- **Play card**: ordered list, markers in mono 12px `--accent`, item gap 7.
- **Avoid card**: border `color-mix(in srgb, var(--accent-2) 45%, transparent)`, heading in `--accent-2-text`.
- Headings come from persona config (Harvey: The read, The play, Don't. Mike: The precedent, The angle, Watch out. Donna: What's really going on, What you do, What you don't).
- **Saved line card**: radius 16, a 2px left inner bar in the line's persona `--accent-2`, top-left glow `radial-gradient(80% 120% at 0% 0%, var(--glow), transparent 60%)`, line in `title-3`, footer with xs avatar, persona short name, date and icon actions (play, copy, share).
- **Banner**: radius 12, 1px border in the semantic colour at 30%, matching `-bg` fill, icon 16, `small` text, optional text action on the right.

### 6.8 Chips

Height 32 visual (44 hit area), radius pill, `small` 12.5px.
- **Situation chip**: transparent, `--hair-2` border, text `#c9cfda`. Tap prefills the composer (or starts voice with the situation preloaded in voice mode).
- **Filter chip**: same, selected state is `--fg` fill with `--bg` text (mirrors the segmented control).
- **Intensity chip**: `--surface-2` fill, mono 11px, `--accent` text. Tap cycles Measured, Sharp, No mercy with a toast.
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

- **Text field**: 52 tall, `--surface-2`, 1px `--hair-2`, radius 12, padding 0 14, text 16px. Label above in mono `label`. Focus: border `--accent`, plus 3px ring `color-mix(in srgb, var(--accent) 25%, transparent)`. Error: border `--danger`, helper text below in `--danger` (`small`). Helper text otherwise `--muted`.
- **Select**: same box with a chevron; opens the native picker.
- **Segmented control**: track `--surface-2` radius 12 padding 3; options radius 9, 13px 500 `--muted`; selected `--fg` fill, `--bg` text.
- **Slider**: track 4px `--surface-3`, filled part `--accent`, thumb 22px `--fg` with `shadow-2`; value shown in mono at right ("1.0x").
- **Switch**: 51 by 31, track `--surface-3` off, `--accent` on, thumb `--fg` off and `--on-accent` on.

### 6.11 List rows

Min height 64, padding 12 / 16, inside a list group (`--surface`, radius 16, hairline dividers inset 16 from the left, or 64 when rows have avatars).
- Leading: md avatar or 20px icon.
- Body: title `body-strong`; subtitle either `small` `--muted` or, for case rows, the line excerpt in serif italic 15px `--fg-2`, one line, ellipsis.
- Trailing: `meta` timestamp and a 16px chevron in `--muted`, or a control (switch, value).
- Pressed: background `--surface-2`. Swipe left reveals Delete (case history) or Unsave (saved lines) in `--danger`.
- Settings rows are 52 tall with label left and value or control right.

### 6.12 Sheet

Bottom sheet, `--surface`, top border `--hair-2`, top radius 24, padding 10 / 20 / 22 plus safe area, `shadow-3`, max height 85%, content scrolls. Grab handle 38 by 4, `--hair-2`. Title in `title-2`. Enter: translateY(100%) to 0 over 320ms `ease-enter`, scrim fades in to `--scrim`. Dismiss by drag down past 30%, tapping the scrim or Escape. Focus is trapped inside; focus returns to the trigger on close. Used for: persona sheet, delivery settings shortcut, Ask another persona, delete confirmation, share.

### 6.13 Toast

Inverted pill (radius 12, `--toast-bg`, `--toast-fg`, 13px, padding 9 / 14, `shadow-2`), centred, 16px above the dock or tab bar. Optional 16px leading icon in a semantic colour and an optional text action. Duration 2600ms, 4000ms with an action. `role="status"`. Enter: fade and rise 8px over 240ms `ease-enter`. Only one toast at a time; a new one replaces the old.

### 6.14 Top bar and tab bar

- **Top bar**: 52 tall. Left: wordmark (home) or back icon button. Centre (detail screens): title in `body-strong` or case matter. Right: icon buttons.
- **Tab bar**: three tabs, Consult, Cases, Saved. 56 tall plus safe area, `--bg` at 85% with 20px backdrop blur, top `--hair`. Icon 22 over mono label 10px; active tab `--fg` with a 2px `--accent` dot above the icon, inactive `--muted`. Hidden in voice mode, onboarding, sign in and the consult flow while a reply is speaking.

### 6.15 Skeletons, empty and error blocks

- **Skeleton**: `--surface-2` blocks with a 1.4s shimmer to `--surface-3` (static under reduced motion). Shapes match final content (avatar circle, two text bars).
- **Empty state**: centred block, 40 top padding, xl avatar of the current persona or a 40px line icon, headline in `title-2`, one `small` line in `--muted`, one primary or secondary button. Headlines can be persona-flavoured but come from config.
- **Inline error**: banner (6.7) with a Retry text action.

## 7. Voice-state choreography

One state machine drives the home talk button, the voice mode screen and the line card. States: `idle`, `listening`, `thinking`, `speaking`, `pausing` (a sub-state of speaking), `interrupted`. Transitions are listed with what every element does.

| State | Avatar | Waveform | Text area | Control | Live region | Haptic |
|---|---|---|---|---|---|---|
| idle | Static, no halo | Flat, 50% | Last line or prompt | Mic icon, label "Tap to talk" | none | none |
| listening | Halo in `--accent-2`, 1200ms | Mic RMS, `--accent-2` | Live transcript | Stop square, label "Tap to finish" | polite: "Listening" once | light on start |
| thinking | Halo off, avatar breathes (scale 1 to 1.03, 2400ms) | Collapsed, dots | Rotating persona thinking copy in serif italic | Ghost Stop | polite: "{short} is thinking" | none |
| speaking | Halo in `--accent`, 1600ms, double ring in voice mode | Audio or synthetic, `--accent` | The line with word lighting, captions always on | Ghost "Tap to interrupt" hint, pause/stop | off (no announcements over speech) | soft on first word |
| pausing | Halo holds at 1.0, glow on | Collapses to glowing line | Current pause mark glows, beat label shows | unchanged | off | none |
| interrupted | Halo stops instantly | Snaps to idle | Unspoken words remain dim, spoken stay lit | Switches to listening after 250ms | polite: "Stopped. Go ahead." | medium |

### 7.1 Transitions

- **idle to listening**: tap the talk button or mic. Voice mode slides up (320ms `ease-enter`); the avatar scales from its home position to 120px. The microphone opens before the animation ends so the first syllable is not lost. If permission is missing, go to the permission prompt (screens.md, onboarding 3) instead.
- **listening**: interim words render in `--muted`, final words in `--fg`, both in `transcript` style, auto-scrolling to keep the last line visible. End of speech: tap the control, release in push-to-talk, or 1.6s of silence after at least 8 characters. Under 8 characters: toast "Give them a little more than that." and stay in listening.
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

## 8. Accessibility

- **Contrast** (measured on `--surface`): `--fg` 15.8:1, `--fg-2` 12.2:1, `--muted` 5.9:1, accents 10.3 to 12.9:1, `--accent-2` Harvey 6.3:1, Mike 7.0:1. Donna's `--accent-2` is 4.45:1, so small Donna text uses `--accent-2-text` `#e07a90` (6.3:1). `--on-accent` on all accent fills is at least 4.8:1. Listening fills use `--on-accent` icons (white on `--accent-2` fails for Harvey and Mike). Unlit words while performing are 2.9:1 by intent; they are a progress cue, the complete text is shown at full contrast before and after, and the visually hidden copy is always available.
- **Captions always on while speaking**: there is no setting to hide text during speech. Voice mode always shows the line with word lighting; the consult result shows the same card. Muting the device does not stop captions.
- **Reduced motion** (`prefers-reduced-motion: reduce`): no halo pulses, waveform loops, shimmer, dots or rotating thinking copy (show the first thinking line). Persona re-tint is instant. Word lighting still happens because it carries meaning, but without transitions. Pause marks still switch to `--accent` during pauses but without glow animation. Voice mode appears with a 150ms fade instead of a slide.
- **Tap targets**: 44 by 44 minimum everywhere, 8px minimum between adjacent targets.
- **Screen readers**: rail is a tablist; voice mode is a dialog (`role="dialog"`, `aria-modal="true"`, labelled "Talking to {name}"); the state label is a polite live region announcing state changes except during speech. Pause marks are hidden. Every icon button has an `aria-label`.
- **Text size**: layouts tolerate 200% text zoom; the line card wraps and grows, the tab bar labels truncate before icons shrink.
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
  --font-serif-src: "Instrument Serif", "Iowan Old Style", "Palatino Linotype", Georgia, serif;
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

  --font-serif: var(--font-serif-src); --font-sans: var(--font-sans-src); --font-mono: var(--font-mono-src);

  --text-display-voice: 36px; --text-display-voice--line-height: 1.14;
  --text-display-line: 31px;  --text-display-line--line-height: 1.16;
  --text-title-1: 28px; --text-title-1--line-height: 1.05;
  --text-title-2: 24px; --text-title-2--line-height: 1.1;
  --text-title-3: 20px; --text-title-3--line-height: 1.2;
  --text-transcript: 22px; --text-transcript--line-height: 1.35;
  --text-body-lg: 16px; --text-body-lg--line-height: 1.55;
  --text-body: 15px; --text-body--line-height: 1.5;
  --text-small: 13px; --text-small--line-height: 1.45;
  --text-fine: 11.5px; --text-fine--line-height: 1.5;
  --text-label: 10.5px; --text-label--line-height: 1.3;
  --text-meta: 11px; --text-meta--line-height: 1.2;
  --tracking-label: 0.14em; --tracking-eyebrow: 0.16em; --tracking-wordmark: 0.42em;

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

Example usage: `<article className="rounded-xl border border-hair bg-surface p-5 shadow-1">`, `<p className="font-serif text-display-line text-fg">`, `<h3 className="font-mono text-label uppercase tracking-label text-muted">`, `<button className="rounded-full bg-accent text-on-accent h-10 px-4">`.

Word and pause classes stay as plain CSS (they are stateful and toggled by the speech engine):

```css
.w { transition: opacity var(--dur-word) var(--ease-standard); }
.performing .w { opacity: .34; }
.performing .w.lit { opacity: 1; }
.pause { display: inline-block; vertical-align: middle; height: 2px; border-radius: 2px; background: var(--dim); margin: 0 .28em; transition: background var(--dur-pause), box-shadow var(--dur-pause); }
.pause[data-len="short"] { width: .55em; }
.pause[data-len="long"] { width: 1.4em; }
.pause.on { background: var(--accent); box-shadow: var(--shadow-glow); }
```

### 9.1 Persona config contract (design fields)

The engineer owns the config file; these are the fields design depends on. Changing personas for a commercial launch means editing only this object.

```ts
type PersonaDesign = {
  id: string;            // used in data-persona, e.g. "harvey"
  name: string;          // "Harvey Specter"
  short: string;         // "Harvey"
  monogram: string;      // "HS"
  role: string;          // one-line role under the name
  theme: { accent: string; accent2: string; accent2Text: string; glow: string; avFrom: string; avTo: string; onAccent: string };
  labels: { read: string; play: string; avoid: string };
  thinking: string[];    // rotating thinking copy
  meta: string;          // template, e.g. "{hours} hrs billed"
  gaps: { short: number; long: number }; // ms
  voiceOptions: { id: string; label: string }[]; // stock TTS voices offered in settings
  emptyStates: { home: string; cases: string; saved: string; limit: string };
};
```

`PersonaTheme` sets `data-persona={id}` and inline CSS variables from `theme`, so a new persona needs no CSS change.
