# Specter MVP screens

Version 1.2. v1.1 fixed the founder's review (sans type system, new brand, geometric persona marks, intensity separated from names). v1.2 fixes design review 01 (`docs/reviews/design-review-01.md`): all ten blockers and most non-blockers. Read with `design-system.md` (tokens and components) and open `mockups.html` to see each screen; frame numbers are given as [F07]. Component names refer to section 6 of the design system. Persona-flavoured strings, allowance numbers and helplines come from config so they swap without design changes.

## Global rules

- **Frame**: 390 by 844 reference, content max 440 wide, side gutter 16 plus safe area. Status bar area uses `--bg`.
- **Persona tint**: the active persona (last used, default Harvey) tints every screen except splash, onboarding 1 and 2, sign in, the paywall and care mode, which use the neutral tint.
- **Navigation**: tab bar with Consult (home), Cases and Saved. The profile button (a circle with the user's initial, or a person icon for guests) sits top right on Home, Cases and Saved and opens Settings. Voice mode is a full-screen dialog over whatever launched it.
- **One talk gesture** (B7): tap to start, tap again to finish, or stop talking and the turn ends on its own after a short silence (threshold tuned in build, starting at 1.6s). No hold gesture in the MVP. Copy is identical on every screen: label "Tap to talk to {short}", sub-label "Tap again when you're done. Or type instead."
- **Where follow-ups go** (B9): the consult result screen [F12, F13] shows only the first reply of a case. Every later reply (push back, new take, another persona, a debrief note) is appended to the case thread [F17], and the app navigates there with the new reply performing at the bottom. Back from the thread goes to Home. Opening a case from Cases or Home always opens the thread.
- **Asking another persona** (B9): "Ask Mike" runs the case with Mike and appends his reply to the thread. Once Mike has answered this case, the chip reads "See Mike's take" and scrolls to his reply without a new call.
- **Free allowance** (B4): count and period come from config (`allowance.count`, `allowance.period`, `allowance.followUpsPerCase`; launch hypothesis 3 consults per week, follow-ups on a case free up to 5). Copy uses templates: "{left} of {count} free consults left this {period}". When one is left, a toast says "Last free consult this week." The next new consult opens the limit screen [F20]. **Care mode is never limited**: a crisis reply is always served, even with the allowance spent or as a guest.
- **Persona pack flag** (N14): the show-name pack shows the fan disclaimer and never shows the paywall; the original pack shows the paywall and no fan disclaimer. Both read the same flag.
- **Offline (applies everywhere)**: a warning banner pinned under the top bar: "You're offline. Past cases and saved lines still work." Cases and saved lines are cached (last 50 cases, all saved lines). Network actions (consult, voice, new take, sign in, export, delete) are disabled with a short reason, never hidden.
- **Errors**: inline banners with Retry, never modal alerts, except destructive confirmations.
- **Loading**: skeletons that match the final layout. Spinners only inside buttons (three dots).
- **Persona naming** (design-system section 10): full name on hero surfaces only (home hero, result hero, persona sheet, onboarding cards); first name everywhere else. Each persona has exactly one `role` (overline, for example "The closer") and one `tagline` (for example "Finds the leverage."), used identically on every screen (N2).
- **Intensity** (design-system 6.16): always its own pill with a dial icon reading "Intensity: Sharp". On Home under the talk button, in voice mode while listening, and in Settings. Hidden in care mode.
- **Pause marks** (B1): `|` = single beat dot, `||` = two beat dots; see CSS `.beat` and `.beat--long`. Marks render as small circular dots on the baseline, never as bars or dashes. Saved lines, copied text, shares and notifications always strip the marks.
- **Text size** (N12): type tokens are in rem; every screen must work at 200% browser zoom and iOS Larger Text. The line card wraps without clipping and the talk label wraps rather than truncating.
- **Mock data**: sample user "Sam", sam@example.com. Never real people.
- **Copy**: no em dashes or en dashes. In plain text the product is always written "Specter" (capital S, no trailing underscore).

## First-run journey (B3)

Splash, What it is [F02], Before we start [F03], Meet the three [F04], Home as guest [F22], first tap on the talk button opens the mic priming sheet [F08], listening, thinking, speaking, result [F12], then the "Keep this case?" sheet [F14] once the reply finishes speaking. "Not now" keeps the guest session. Starting a second new consult as a guest opens the same sheet without "Not now". Returning signed-out users go from splash to sign in [F05].

---

## 1. Splash [F01]

**Purpose**: cover the PWA launch while the session is restored.

**Layout**: neutral tint. Three overlapping xl persona avatars (chevron, grid, waves), the SVG wordmark at 30px, a hairline that grows as the session resolves. Bottom `fine`: "Original lines. Stock voices. Your cases stay private."

**Behaviour**: at most 1.2s. First launch: onboarding 1. Returning guest or signed in: Home. Returning signed out (had an account): sign in.

**States**: loading is this screen. Error: session restore failed, continue to Home as guest with banner "Couldn't restore your session. Sign in to get your cases back." Offline: cached session goes Home with the offline banner.

## 2. Onboarding 1: What it is [F02]

**Purpose**: explain the product in one breath and show the signature interaction.

**Layout**: progress of three segments, Skip (goes to step 2, which cannot be skipped). A demo line card (neutral tint) performs an original line with word lighting and glowing beats. `display-hero` "Bring the situation. Leave with the line." `body-lg`: "Describe what's happening at work or in life, by voice or text. You get a line worth repeating, a read on the room, three moves and one thing to avoid." Primary "Continue".

**States**: demo uses bundled text and a pre-rendered clip, so no error or offline state. If audio cannot autoplay, lighting runs silently on estimated timing.

## 3. Onboarding 2: Before we start [F03] (B2)

**Purpose**: the 18+ gate and AI disclosure, acknowledged before any consult.

**Layout**: neutral tint, progress 2 of 3, no Skip. `display-hero` "Before we start." Three rows with icons:
1. Sparkle icon: "Specter is an AI coach. Not a person, a lawyer or a therapist."
2. Shield icon: "Advice is for everyday situations. For legal, money or medical decisions, see a professional."
3. Phone icon: "If you're ever in crisis, call {helpline name} on {number}." (region config, India shown: Tele-MANAS, 14416).
Text link "Read our safety policy". Primary "I'm 18 or older". Ghost "I'm under 18". `fine`: "By continuing you agree to the Terms and Privacy Policy."

**Behaviour**: primary stores `age_confirmed_at` and `disclosure_ack_at` (on the anonymous profile, carried over on sign in) and continues. Under 18 goes to 3a.

**States**: no loading (writes are queued). Offline: still works; acknowledgements sync later.

### 3a. Under 18 [F29]

Neutral tint. `display-hero` "Specter is for adults." `body-lg`: "Thanks for being honest. Specter is built for people 18 and over, so we can't continue. If something's weighing on you, these people are there to talk, any time." Helpline buttons as in care mode (named local line first). No back to onboarding in the same session; the choice is remembered on the device.

## 4. Onboarding 3: Meet the three [F04]

**Purpose**: pick a default persona; the app re-tints for the first time.

**Layout**: `title-1` "Pick who's in your corner." Three selectable persona cards, each tinted by its persona: lg avatar, role in `overline`, full name in `title-3`, tagline in `small`, mini play button for a 3 second original greeting. Fan disclaimer `fine` (show-name pack only). Primary "Start with Harvey" (follows selection), which lands on Home as a guest.

**States**: Harvey preselected. Greeting loading shows dots in the play button; failure shows a muted icon and toast "Voice preview unavailable. You can still pick." Offline: previews disabled unless cached.

## 5. Home [F07; guest first run F22]

**Purpose**: start a consult in one tap, by voice first; pick up cases; close the loop on past moments.

**Layout** (top to bottom):
1. Top bar: wordmark left; profile button right (initial "S"; for guests a person icon plus a small "Sign in" text button beside it).
2. Persona rail.
3. Hero: full name `title-1`, tagline `small` muted, centred.
4. Talk button with label "Tap to talk to Harvey" and sub-label "Tap again when you're done. Or type instead." ("type instead" opens the composer dock). Intensity control below.
5. **Debrief card** (B6), only when a case's moment has passed and is unanswered: persona-tinted card, xs avatar, `title-3` "How did it go with Cofounder's CTO pick?", chips "Used it", "Partly", "Didn't", and a text button "Add a note". A chip answers in place (card collapses to a thank-you toast "Logged. Nice work." or, for Didn't, "Noted. Want to talk it through?" with a button that opens the thread). Add a note opens the thread with the composer focused; the note goes to the same persona.
6. Quick situations: `section` label and a single scrolling row of situation chips with a trailing fade into the background (N15).
7. Recent cases: up to 3 rows, "See all".
8. Tab bar.

**States**
- Guest first run (empty) [F22]: recent cases is replaced by an example card ("Try one") with the persona's example line from config and a play button. Allowance hint `small` under the talk control: "Your first consult is on us."
- Loading: recent cases show 3 skeleton rows; talk is usable at once.
- Error: banner "Couldn't load your cases." with Retry.
- Offline: talk disabled ("Voice needs a connection"), type instead drafts only, cached cases, banner.
- Allowance spent: talk button disabled state with label "Free consults reset {weekday}" and a text button "See options" (opens the limit screen). Care mode remains reachable by any consult that triggers it (the server pre-screen runs before the quota check).

## 6. Mic priming sheet [F08] (N1)

**Purpose**: ask for the microphone in context on the first talk tap, not during onboarding.

**Layout**: sheet over Home. 2xl persona avatar with a still waveform, `title-2` "Talk it through.", `body`: "Specter listens only while the button is lit. Your audio becomes text and isn't stored." Rows with icons: "Tap to talk, tap again when you're done" and "Captions are always on while they speak". Primary "Allow microphone" (triggers the OS prompt, then opens voice mode listening). Ghost "Type instead".

**States**: OS prompt open: primary shows dots. Denied: voice mode mic-off screen [F26]. Unsupported browser: skip the sheet and open the composer with toast "Voice isn't available in this browser. Type it instead."

## 7. Voice mode [F09 listening, F10 thinking, F11 speaking]

**Purpose**: the full-screen conversation surface.

**Layout**: full-screen dialog, persona wash, no tab bar.
- Top row: close, persona chip (sm avatar and first name only), keyboard button.
- 2xl avatar with halo; state label in `overline`.
- Text area. Listening: live transcript in Geist 20, interim words `--muted`. Thinking: one-line "You" echo, rotating thinking copy in `title-2`, then the status "Harvey is on it" in `small` sentence case (N5). Speaking: principle eyebrow, the line in `display-voice` with word lighting and baseline beats, two-liner in `body-lg`. Captions cannot be hidden.
- Intensity control while listening only.
- Waveform; during a pause the waveform collapses to two glowing beats, echoing the mark in the text.
- Controls. Listening: ghost "Cancel", 76px control (stop square), hint above "Tap again when you're done." Speaking: hint "Tap anywhere to interrupt", ghost "Stop", pause control, text button "See the full answer" (N4).

**Behaviour**: when speaking ends (or See the full answer), the first reply morphs into the result [F12]. For follow-ups (an interruption, or voice push back from the thread), it closes onto the thread [F17] with the new reply in place.

**Care mode in voice** (B5): if the reply comes back with `mode: "care"` or the pre-screen fires, voice mode skips the speaking state entirely. The thinking state cross-fades (240ms) to neutral, voice mode closes, and the care screen [F27] opens. If voice is on, the care message is spoken in the neutral calm voice at normal pace, with no beats, halo, persona chip or intensity pill.

**States**
- Listening with no speech: placeholder "Go ahead. What happened?" After 8s of silence, toast "Didn't catch that. Try again." and close.
- Thinking over 12s: `small` "Taking longer than usual." with Stop.
- Mic denied [F26]: "Your mic is off." with primary "Type instead" and "How to enable the mic" (sheet with Safari and Chrome steps).
- Consult failed: banner in the text area "That didn't go through. Your words are saved." Retry, Edit.
- TTS failure: line fully lit, toast "Voice unavailable. Here it is in writing."
- Interrupted: audio stops, label "Go ahead", mic reopens after 250ms; the push back is appended to the thread.
- Offline: cannot open. Limit reached: routes to [F20] (care exempt).

## 8. Consult result: first reply [F12, F13]

**Purpose**: the first answer of a case in full, plus the hooks to continue, save, time and rate it.

**Layout** (scrolls; dock fixed):
1. Top bar: back (to Home), matter title, overflow (Copy line, Share, Delete case).
2. Hero: lg avatar, full name `title-2`, tagline `small`.
3. Situation echo with "You" tag.
4. Line card: principle, the line, the two-liner, mini player, bookmark (toast "Saved to your lines").
5. **When is it happening?** (B6): a quiet row under the line card. Clock icon, `small` "When is it happening?", chips Today, Tomorrow, This week, Pick a time (native date and time picker). After choosing, the row collapses to "Happening Tomorrow, 10:00" with Change. Sets `moment_at`; the debrief card appears after that time.
6. Cards: Read, Play, Avoid. Harvey's avoid label is "Avoid" (N3); avoid sentences never start with "Don't" (persona spec rule).
7. Actions: two equal-width secondary buttons, "Replay" and "New take" (N9). Push back lives in the dock.
8. "Ask another persona": persona chips "Ask Mike", "Ask Donna" (or "See Mike's take" when he has answered).
9. **Was this useful?** (B8): `small` label with thumbs up and thumbs down icon buttons. Up: fills `--accent`, toast "Thanks. Noted." Down: opens the feedback sheet [F15].
10. Footer `fine`: fan disclaimer (show-name pack only).
11. Dock: composer, placeholder "Push back, or tell Harvey what happened next" (N6). Sending, the mic, New take and Ask chips all append to the thread and navigate there (B9).

**Feedback sheet [F15]**: `title-2` "What missed?", reason chips (multi-select off, single choice) Too long, Off target, Not their voice, Unsafe, Other; optional note field "Anything else? (optional)"; primary "Send". Unsafe also shows `small` "Thanks. A person reviews every unsafe flag." Stores `feedback.rating`, `reason`, `note`.

**States**
- Loading (typed first consult) [F24]: thinking overlay on the line card, skeleton cards below, ghost Stop.
- Error: banner "The answer came back garbled. Try again." / "Too many requests right now. Give it a minute." / "That one won't work as written. Reframe it and try again." with Retry; the user's words stay in the composer.
- Decline (N13): when `mode` is decline (a harmful ask redirected in character), the layout is unchanged, but New take is hidden and no "When" row is shown.
- Care: never rendered here; goes to the care screen [F27].
- Deleted case deep link: "This case was deleted." with Home.
- Offline: Replay works from cache or device voice; New take, Ask chips and the dock are disabled with "Needs a connection".

## 9. Keep this case? and sign in [F14, F05, F06] (B3)

**Keep this case? sheet [F14]**: shown to guests once the first reply finishes speaking (or 2s after it renders when voice is off), over the result. Grab handle, xs avatar row, `title-2` "Keep this case?", `body`: "Sign in to save Cofounder's CTO pick and your lines, and pick up on any device." Google button, "Continue with email" secondary (expands an email field and "Send me a link"), ghost "Not now". "Not now" dismisses; the case stays on the device as a guest case. On a second new consult as a guest, the sheet opens before the consult with no "Not now" and the title "Sign in to keep going."

**Sign in [F05]** (returning users and the sheet's full-screen variant): neutral tint, wordmark, `display-hero` "Your cases, kept private.", Google, divider, email field (placeholder "you@work.com"), primary "Send me a link", terms `fine`.

**Link sent [F06]**: mail icon, `display-hero` "Check your inbox.", "We sent a sign-in link to sam@example.com. It expires in 15 minutes.", "Open mail app", resend countdown, "Use a different email". On sign in the anonymous user is linked so the guest case is kept; toast "Case saved to your account."

**States**: invalid email field error; send failure banner; expired link banner; Google cancelled returns silently; offline disables both methods.

## 10. Care mode [F27] (B5)

**Purpose**: when crisis or self-harm signals appear, drop the persona and connect the person to help.

**Entry**: from a typed consult (replaces the result), from voice mode (skips speaking), or from the pre-screen. Never blocked by the allowance or guest status.

**Layout**: neutral tint, no persona avatar, chip, tagline, billing meta, beats or intensity. Top bar: back only. Heart icon and `title-2` "Let's pause the advice for a moment." Message card in `body-lg` (the model's warm plain message). Help card:
- Primary (named helpline from region config, `tel:` link): India "Call Tele-MANAS, 14416"; US "Call or text 988"; UK "Call Samaritans, 116 123".
- Secondary: local emergency number ("Call 112" in India, "Call 911" in the US, "Call 999" in the UK).
- Text link "Other countries" opening the vetted directory.
Up to three plain safety steps from the reply (`play` in care mode) as a simple list. `fine`: "Specter is not a substitute for professional help."

**Behaviour**: spoken in the neutral voice only if voice is on. The case is kept and marked care; reopening it shows this screen, not a persona reply. The next consult starts at Measured intensity.

**States**: offline: the helpline buttons still work (they are `tel:` links); the message shows from cache.

## 11. Case history [F16]

**Layout**: `title-1` "Cases", profile button. Search field, persona filter chips, grouped list (Today, This week, Earlier). Rows: avatar of the last persona (stacked second avatar when more than one answered), matter, excerpt (marks stripped), time. A small "Debrief" tag (accent outline, `overline`) on rows whose moment has passed and is unanswered (B6). Swipe left to delete (confirmation sheet). Tapping a row opens the thread.

**States**: empty "No cases yet." with "Start a consult"; search no results; 6 skeleton rows [F23]; error banner; offline cached and local search.

## 12. Case thread [F17]

**Purpose**: the full history of one case; where every follow-up lands (B9).

**Layout**: top bar back (to Home), matter title, overflow (Rename, Delete). Pinned at top: the moment row ("Happening Mon, 12:00" with Change) or, once passed and unanswered, the debrief card (B6). Thread:
- User turns: right-aligned bubbles, mic glyph when spoken.
- Persona turns: compact line cards tinted by the persona that answered, xs avatar and first name, principle, the line in `title-3`, two-liner, mini player, and "Show more" (N4) expanding Read, Play, Avoid and the thumbs row.
- Persona switch dividers ("Asked Mike") and take markers ("Take 2").
- Under the latest reply: Ask chips for personas who haven't answered, and "See {short}'s take" for those who have.
Dock: composer with the persona switch chip on the left, defaulting to the persona of the latest reply (N6); placeholder "Push back, or tell {short} what happened next".

**States**: loading skeleton turns; new reply shows dots in a compact card tinted to the answering persona; failed reply [F25] shows a danger-bordered card "That didn't go through." with Retry and keeps the user's turn; offline read-only.

## 13. Saved lines [F18] (B8)

**Layout**: `title-1` "Saved", profile button, persona filter chips, saved line cards tinted by persona. The line is plain text with marks stripped (B1), in `title-3`. Footer: xs avatar, first name, date, Play, Copy, and an overflow button (Share, Open case, Remove). Swipe left reveals a red "Remove" action; removing shows the toast "Line removed." with "Undo" for 4s.

**States**: empty "Nothing saved yet." with "Go to cases"; 4 skeleton cards; error banner; offline fully available (removal queues and syncs).

## 14. Settings [F19, F28] (B10)

**Layout**: back, `title-1` "Settings".
1. **Account**: signed in: initial avatar, "sam@example.com", method "Google". Guest: row "Not signed in. Sign in to keep your cases." with chevron to sign in.
2. **Usage**: "Free consults" with value "1 of 3 left this week" (templated from config). Hidden on Pro.
3. **Voices**: one row per persona, "Harvey's voice" with value, sheet of stock voices with Preview. Hint about stock voices.
4. **Delivery**: Pace slider, Intensity segmented control, Speak replies switch, captions note.
5. **Privacy**: "Download my data" (prepares a JSON export of profile, cases, consults, saved lines; row shows "Preparing..." then a toast "Your data is ready." with "Download"), "Delete all cases" (confirmation sheet: "Delete all cases?", "This removes every case, reply and saved line. Your account stays.", destructive "Delete all cases", ghost "Cancel"), "Privacy policy", "Safety policy".
6. Secondary "Sign out" (signed in only). Destructive "Delete account".
7. `fine` footer: disclaimer per pack, version.

**Delete account sheet [F28]**: `title-2` "Delete your account?", body, text link "Download my data first" (starts the export and keeps the sheet open), "Type DELETE to confirm" field, destructive "Delete everything", ghost "Keep my account".

**After deletion** (N11): splash, then onboarding 1 with toast "Your account and data are deleted."

**States**: account rows skeleton while loading; save failure toast "Couldn't save that. We'll keep trying."; export failure toast with Retry; delete failure banner in the sheet; offline: delivery changes locally, export and deletes disabled with "Needs a connection".

## 15. Free allowance used [F20] (B4)

**Purpose**: end the free allowance gracefully and show what still works.

**Layout**: current persona tint. xl avatar (no halo), mono "RESETS MONDAY" (from config period), `display-hero` persona line from config (Donna: "Even I clock out. Eventually."), `body-lg` template: "You've used your {count} free consults this {period}. They reset on {weekday}. Your cases and saved lines are all still here." Buttons: primary "See plans" (paywall flag only; original pack), secondary "Open saved lines", secondary "Read past cases". Follow-ups on existing cases stay available up to the per-case limit: `small` "You can still follow up on your open cases." "Notify me at reset" appears only where notifications are supported and already granted (N10). Spec note: care mode is never limited.

**States**: loading "Checking your allowance" with dots; if the count can't be verified the client lets the consult through and the server enforces (API 402); offline same screen.

## 16. Paywall stub [F21] (B4)

**Purpose**: test willingness to pay without billing. Shown only when the paywall flag is on (original persona pack; never with the show-name pack).

**Layout**: sheet, neutral tint. Wordmark-tinted header "Specter Pro", `title-2` "Every moment covered." Value list with check icons: "Unlimited consults", "Studio voices for every persona", "All personas, every time", "Your full case history". Plan cards, annual first (selected, tag "Best value", "{price} a year", "{monthly equivalent} a month"), monthly second. Primary "Continue" (no billing). On tap: button becomes a success state "Coming soon. We'll tell you first." and logs interest. Ghost "Not now". `fine`: "No payment is taken. Prices are examples."

**States**: offline: primary disabled. Already registered interest: primary reads "You're on the list".

---

## State coverage at a glance

| Screen | Empty | Loading | Error | Offline |
|---|---|---|---|---|
| Splash | n/a | itself | restore failed, guest Home | cached session |
| Onboarding 1 to 3 | defaults | static demo | preview fail | works, syncs later |
| Under 18 | n/a | n/a | n/a | helplines work |
| Home | guest example card | skeleton rows | cases banner | drafts, cached |
| Mic priming | n/a | prompt dots | denied, unsupported | n/a |
| Voice mode | "Go ahead" | thinking | mic denied, fail, TTS | cannot open |
| Result | deleted case | overlay, skeletons | banners; decline state | replay only |
| Keep this case / sign in | disabled CTA | button dots | invalid, send fail, expired | disabled |
| Care mode | n/a | n/a | n/a | helplines work |
| Cases | no cases, no results | skeleton rows | banner | cached |
| Thread | n/a | skeleton turns | failed reply card | read only |
| Saved | nothing saved | skeleton cards | banner | full, removals queue |
| Settings | defaults | account skeleton | save, export, delete fail | local only |
| Allowance used | n/a | checking | fail open | same |
| Paywall | n/a | n/a | n/a | disabled |
