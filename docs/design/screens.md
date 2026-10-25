# Specter MVP screens

Version 1.0. Read with `design-system.md` (tokens and components) and open `mockups.html` to see each screen. Component names below refer to section 6 of the design system. All copy here is final unless marked as config; persona-flavoured strings come from persona config so they swap with the characters.

## Global rules

- **Frame**: 390 by 844 reference, content max 440 wide, side gutter 16 plus safe area. Status bar area uses `--bg`.
- **Persona tint**: the active persona (last used, default Harvey) tints every screen except splash, sign in, onboarding steps 1 and 3 and the safety response, which use the neutral tint.
- **Navigation**: tab bar with Consult (home), Cases and Saved. Settings is a top bar icon on home, Cases and Saved. Voice mode is a full-screen dialog over whatever launched it.
- **Offline (applies everywhere)**: a warning banner pinned under the top bar: "You're offline. Past cases and saved lines still work." Cases and saved lines are cached by the service worker (last 50 cases, all saved lines). Actions that need the network (consult, voice, another take, sign in, delete account) are disabled with a short reason, never hidden.
- **Errors**: inline banners with Retry, never modal alerts, except destructive confirmations.
- **Loading**: skeletons that match the final layout. Spinners only inside buttons (three dots).
- **Daily limit**: a persistent count is not shown; at 2 consults left a toast says "Two consults left today." When the limit is hit, the next attempt opens the limit screen.
- **Copy**: no em dashes or en dashes.

---

## 1. Splash

**Purpose**: cover the PWA launch while the session is restored; set the tone in under a second.

**Layout**: neutral tint background recipe. Centred wordmark "SPECTER" (mono, 0.42em tracking, 13px) above a 64px row of three overlapping xl avatars (HS, MR, DP), each with its own persona gradient. A 1px hairline below grows from 0 to 120px wide as the session resolves. Bottom: `fine` text "Original lines. Stock voices. Your cases stay private." in `--muted`.

**Components**: persona avatar (xl), wordmark.

**Behaviour**: shown for at most 1.2s or until auth resolves. Signed out and first launch: onboarding 1. Signed out, returning: sign in. Signed in: home. Avatars fade in staggered 80ms; under reduced motion they appear together.

**States**
- Empty: not applicable.
- Loading: this screen is the loading state.
- Error: if auth check fails, continue to home in signed-out read mode and show the sign in screen with banner "Couldn't restore your session. Sign in again."
- Offline: if a cached session exists, go to home with the offline banner; otherwise sign in with offline state.

## 2. Onboarding 1: What it is

**Purpose**: explain the product in one breath.

**Layout**: top: progress of three segments (2px bars, active `--fg`, inactive `--hair-2`) and Skip text button right. Middle: a mini line card demo using the neutral tint, auto-performing one original sample line with word lighting and a glowing pause, so the first thing a user sees is the signature interaction. Below: `title-1` "Bring the situation. Leave with the line." and `body` in `--fg-2`: "Describe what's happening at work or in life, by voice or text. You get a line worth repeating, a read on the room, three moves and one thing to avoid." Bottom: primary button "Continue".

**Components**: progress bar, line card (demo), primary button, text button.

**States**
- Empty: not applicable.
- Loading: demo card renders statically if fonts are still loading.
- Error: none possible; the demo uses bundled text and a pre-rendered audio clip (no TTS call). If audio cannot play, the lighting still runs on the estimated timing, silently.
- Offline: works fully.

## 3. Onboarding 2: Meet the three

**Purpose**: introduce the personas and let the user pick a default. This is where the app first re-tints.

**Layout**: title `title-1` "Pick who's in your corner." Three stacked selectable persona cards (radius 16, `--surface`, each card locally tinted by its persona): lg avatar, name in `title-3`, role line in `small`, one-word mode in mono label ("THE CLOSER", "THE PRODIGY", "THE READER"), and a tiny play button that speaks a 3 second original greeting in that persona's stock voice. The selected card gets an `--accent` border and its persona tints the whole screen. Under the cards: `fine` disclaimer from config: "Unofficial fan project. Every line is original and written in the spirit of the characters. Voices are stock voices, not the actors." Bottom: primary "Continue with Harvey" (name follows selection).

**Components**: persona avatar (lg), selectable card, mini play button, primary button.

**States**
- Empty: Harvey preselected.
- Loading: greeting audio shows dots in the play button while fetching.
- Error: greeting fails: the play button shows a muted icon and toast "Voice preview unavailable. You can still pick."
- Offline: previews disabled (greetings are cached after first load, so usually still playable).

## 4. Onboarding 3: Voice permission

**Purpose**: earn microphone permission with context, before the OS prompt.

**Layout**: neutral tint returns to keep it trustworthy. A 2xl avatar of the chosen persona with a still waveform under it. `title-1` "Talk it through." `body`: "Specter listens only while the button is lit. Audio is turned into text and not stored." Two small rows with icons: "Tap to talk, tap to finish" and "Captions are always on while they speak". Bottom: primary "Allow microphone" (triggers the browser prompt), ghost "Not now, I'll type".

**Components**: avatar (2xl), list rows (icon), primary and ghost buttons.

**States**
- Empty: not applicable.
- Loading: primary shows dots while the OS prompt is open.
- Error (denied): content swaps to "No problem. You can type everything, and turn the mic on later in your browser settings." with primary "Continue" and a text button "How to enable the mic" that opens a sheet with steps for iOS Safari and Chrome.
- Unsupported (no getUserMedia): skip this step automatically.
- Offline: allowed; permission does not need the network.

## 5. Sign in

**Purpose**: create an account or sign in with an email magic link or Google. Placed after onboarding so value is shown first.

**Layout**: neutral tint. Wordmark top centre. `title-1` "Your cases, kept private." `small` muted "Sign in to save cases and lines across devices." Google button (white, full width, 52). Divider with "or" in mono. Email text field (label "EMAIL", placeholder "you@work.com", `inputmode="email"`, autocomplete email). Primary "Send me a link". Bottom `fine`: "By continuing you agree to the Terms and Privacy Policy." with both as links.

**Variant: link sent**: the form is replaced by a success block: 40px mail icon in `--success`, `title-2` "Check your inbox.", `small` "We sent a sign-in link to aditya@example.com. It expires in 15 minutes.", text buttons "Open mail app" and "Resend in 30s" (counts down, then "Resend link"), and "Use a different email".

**Components**: Google button, text field, primary button, text buttons, banner.

**States**
- Empty: field empty, primary disabled until a valid-looking email.
- Loading: primary shows dots; Google button shows dots and is disabled during redirect.
- Error: invalid email: field error "That doesn't look like an email." Send failure: danger banner "Couldn't send the link. Try again." Link expired (arriving from a stale link): banner "That link expired. Send a new one." Google cancelled: no message, return to form.
- Offline: both methods disabled, warning banner "Sign in needs a connection."

## 6. Home

**Purpose**: start a consult in one tap, by voice first; pick up recent cases.

**Layout** (top to bottom):
1. Top bar: wordmark left; settings icon button right.
2. Persona rail.
3. Hero line under the rail: persona name in `title-1` and role in `small` muted, centred.
4. Talk button, centred, with label "Tap to talk to Harvey" and sub-label "or hold to talk, release to send". Text button "Type instead" under it opens the composer dock with the keyboard.
5. Quick situations: mono label "QUICK SITUATIONS" with a horizontal row of situation chips, led by the intensity chip ("SHARP"). Situations are config: "They lowballed my offer", "My boss took credit", "A client wants out", "Asking for a raise", "Talked over in a meeting", "Letting someone go", "First week, new job".
6. Recent cases: mono label "RECENT CASES" with "See all" text button; list group of up to 3 case rows (avatar, matter, line excerpt in serif italic, relative time).
7. Tab bar (Consult active).

**Components**: top bar, persona rail, talk button, chips, list rows, tab bar, composer (on Type instead).

**Behaviour**: tapping a situation chip opens voice mode with that situation pre-spoken as the first transcript sentence so the user only adds detail (or, in the composer, prefills the text). Switching persona re-tints in 600ms and changes the label and placeholder.

**States**
- Empty (first run, no cases): the recent cases section becomes an example card: "Try one. Tap a quick situation, or just say what happened today." plus a compact line card showing the persona's example line from config, with a play button.
- Loading: recent cases show 3 skeleton rows; the talk button is usable immediately.
- Error: recent cases failed to load: inline banner "Couldn't load your cases." with Retry; consulting still works.
- Offline: talk button disabled ("Voice needs a connection"), Type instead still opens the composer to draft (send waits for connection), recent cases come from cache, banner shown.

## 7. Voice mode

**Purpose**: the full-screen conversation surface. Listening, then thinking, then speaking with live captions and visible pauses. Tap anywhere to interrupt.

**Layout**: full screen dialog, persona wash background, no tab bar.
- Top row: close icon button (left), persona chip with sm avatar, "Harvey" and intensity in mono ("SHARP") centre, keyboard icon button (right) to switch to typing.
- Upper middle: 2xl avatar with halo; under it a mono state label ("LISTENING", "THINKING", "SPEAKING", "PAUSE").
- Middle: the text area.
  - Listening: live transcript in `transcript` style, final words `--fg`, interim words `--muted`, left aligned, newest line kept in view.
  - Thinking: the user's words collapse to a one-line "You" echo at top; centre shows rotating persona thinking copy in serif italic `title-2` with dots.
  - Speaking: principle eyebrow, then the line in `display-voice` with word lighting and pause marks, followed by the two-liner in `body-lg`. These are the captions and cannot be hidden.
- Lower: voice waveform (28 bars).
- Bottom: controls row. Listening: ghost "Cancel" left, 76px talk control (stop square) centre, empty right. Speaking: hint in `small` muted "Tap anywhere to interrupt", then ghost "Stop" left, 76px control showing pause glyph centre, text button "Full play" right.

**Components**: avatar (2xl), voice waveform, talk button (76), line card text styles, chips, icon buttons.

**Behaviour**: see design system section 7. On finish (or Full play), voice mode morphs into the consult result: the line keeps its position and the cards slide up beneath it (400ms).

**States**
- Empty (listening with no speech yet): placeholder transcript in `--muted`: "Go ahead. What happened?" After 8s of silence, toast "Didn't catch that. Try again." and close to home.
- Loading (thinking): as described. If thinking passes 12s, add `small` "Taking longer than usual." with the Stop button kept.
- Error: mic denied: avatar dimmed, title "Your mic is off.", body "Type instead, or allow the microphone in your browser settings.", primary "Type instead", text "How to enable". Recogniser error: toast "Didn't catch that. Try again." and stay listening. Consult failed: banner in the text area "That didn't go through. Your words are saved." with Retry and Edit as text. TTS failure: line shown fully lit, toast "Voice unavailable. Here it is in writing."
- Interrupted: audio stops, unspoken words stay dim, state label "GO AHEAD", mic opens after 250ms; what the user says is sent as a push back on the same case.
- Offline: voice mode cannot open; the talk button is disabled. If the connection drops mid-session, the session ends with the network banner and the transcript is moved to the composer as a draft.
- Limit reached: opening voice mode at the limit routes to the limit screen.

## 8. Consult result

**Purpose**: the full answer, replayable and actionable: the line, the two-liner, the read, the play, the avoid, and ways to continue.

**Layout** (scrolls; dock fixed at bottom):
1. Top bar: back icon button; centre the matter title from the model ("Cofounder's CTO pick") in `body-strong`; right overflow icon (Copy line, Share, Delete case).
2. Compact hero: xl avatar (halo while speaking), name `title-2`, role `small`.
3. Situation echo: "YOU" tag chip then the situation in `small` muted, max 3 lines with "More".
4. Line card: principle eyebrow, the line, the two-liner, mini player (play or stop, waveform, beat label, meta), bookmark icon top right to save the line (filled `--accent` when saved, toast "Saved to your lines").
5. Cards: Read, Play (three numbered moves), Avoid. Headings from persona config.
6. Action row (wrapping): secondary "Replay", secondary "Another take", secondary "Push back".
7. "ASK ANOTHER PERSONA" label with two persona chips ("Ask Mike", "Ask Donna"), each tinted with that persona's accent. Tapping runs the same situation with that persona and appends the reply into the case thread (opens case detail scrolled to the new reply).
8. `fine` disclaimer from config.
9. Dock: composer with mic, placeholder "Push back, or tell Harvey what happened next". Push back in the action row focuses this composer; the mic opens voice mode as a push back.

**Components**: top bar, avatar, line card, cards, buttons, persona chips, composer, toast, sheet (share and delete confirmation).

**Behaviour**: if Speak replies is on and the user arrived from a typed consult, the line performs automatically once. Another take replaces the current answer in place (previous take kept in the thread, reachable from case detail) and performs it. Copy line copies the plain line and two-liner plus the persona short name.

**States**
- Empty: not applicable (always has a reply); arriving from a deep link to a deleted case shows "This case was deleted." with a button to home.
- Loading: when opened from typing, the line card shows the thinking overlay from the prototype (blurred surface, serif italic rotating copy, dots, "Harvey is on it", ghost Stop) while the cards below show skeletons. Another take and Ask another persona show the same overlay on the card only.
- Error: banner above the action row: "The answer came back garbled. Try again." (invalid output), "Too many requests right now. Give it a minute." (rate limit), "That one won't work as written. Reframe it and try again." (refused). Each with Retry. The previous answer stays visible.
- Safety response (crisis or self-harm signals): the screen switches to the neutral tint, the persona hero is replaced by a plain heading "Let's pause the advice for a moment.", the line card shows a calm, warm message in `body-lg` with no pause marks, no principle and no billing meta, followed by a card "If you're in danger or thinking about hurting yourself, contact local emergency services now." with buttons "Call emergency services" (tel: link from region config) and "Find a crisis line" (opens a vetted directory link). It is spoken, if at all, in a neutral voice without performance. Another take, Ask another persona and the intensity chip are hidden.
- Offline: replay works if the audio was cached (otherwise falls back to device voice), Another take, Push back and Ask another persona are disabled with "Needs a connection", the banner shows.

## 9. Case history list

**Purpose**: find and reopen any past case.

**Layout**: top bar with `title-1` "Cases" left aligned and settings icon right. Search field (40 tall, search icon, placeholder "Search your cases"). Filter chips: All, Harvey, Mike, Donna (each persona chip shows an xs avatar). Grouped list: mono section labels "TODAY", "THIS WEEK", "EARLIER". Case rows: md avatar of the persona who answered last (a small stacked second avatar when more than one persona answered), title is the matter, subtitle the line excerpt in serif italic, trailing relative time. Swipe left to delete (confirmation sheet). Tab bar with Cases active.

**Components**: search input, filter chips, list rows, avatar, tab bar, sheet.

**States**
- Empty: xl avatar of the current persona, `title-2` "No cases yet.", `small` "Every situation you bring is kept here, privately.", primary "Start a consult". Search with no results: "Nothing matches that. Try a name, a place, or a word from the line."
- Loading: 6 skeleton rows under the search field.
- Error: banner "Couldn't load your cases." with Retry; cached rows shown below if any.
- Offline: cached cases shown with the offline banner; search works on cached items; delete disabled.

## 10. Case detail thread

**Purpose**: the full history of one case: the situation, every reply, push backs, other takes and other personas.

**Layout**: top bar with back, matter title, overflow (Rename, Delete). Thread, newest at the bottom:
- User turns: right aligned bubbles (`--surface-2`, radius 18 with a 6 corner bottom right, `body`), with a mic glyph when spoken.
- Persona turns: left aligned compact line cards, tinted locally by the persona that answered: xs avatar and name row, principle eyebrow, the line in `title-3` serif, the two-liner in `small`, a mini player, and a "Full play" text button that expands the read, play and avoid cards inline.
- Persona switch dividers: centred mono label "ASKED DONNA" with xs avatar, hairlines either side.
- Another take markers: "TAKE 2" eyebrow on the reply.
Dock: composer addressed to the persona of the latest reply, with a small persona switch chip on the left of the composer to change who answers next.

**Components**: chat bubbles, compact line card, cards, avatar, dividers, composer, persona chip.

**States**
- Empty: not possible (a case has at least one turn).
- Loading: skeleton of two turns; new replies show the thinking dots inside a compact card tinted to the answering persona.
- Error: failed reply shows a compact card with danger border, "That didn't go through." and Retry; the user's turn is kept.
- Offline: thread readable from cache, players use cached audio or device voice, composer drafts but does not send.

## 11. Saved lines

**Purpose**: a personal collection of the lines worth repeating.

**Layout**: top bar `title-1` "Saved" and settings icon. Filter chips All, Harvey, Mike, Donna. Vertical list of saved line cards (each tinted by its persona): the line in `title-3`, footer with xs avatar, persona short name, date, and icon buttons Play, Copy, Share. Tapping the card opens the source case. Tab bar with Saved active.

**Components**: saved line card, filter chips, icon buttons, tab bar, toast.

**States**
- Empty: 40px bookmark icon, `title-2` "Nothing saved yet.", `small` "Tap the bookmark on any line you want to keep.", secondary "Go to cases".
- Loading: 4 skeleton cards.
- Error: banner with Retry.
- Offline: all saved lines available (always cached); Share uses the native share sheet with plain text.

## 12. Settings

**Purpose**: tune delivery per persona and manage the account.

**Layout**: top bar with back and `title-1` "Settings". Grouped list:
1. **Voices** (label "VOICES"): one row per persona: md avatar, "Harvey's voice", value "Low and steady" with chevron; tapping opens a sheet listing the stock voices from config, each with a Preview button. Hint: "Stock voices chosen to fit each character. Not the actors' voices."
2. **Delivery** (label "DELIVERY"): Pace slider (0.8x to 1.2x, value in mono), Intensity segmented control (Measured, Sharp, No mercy), switch "Speak replies out loud". A fixed note row: "Captions are always on while a persona speaks."
3. **Account** (label "ACCOUNT"): email row with sign-in method ("Google" or "Email link"), "Daily consults" row showing "6 of 10 used today", Privacy policy, Terms.
4. Secondary button "Sign out" (full width).
5. Destructive button "Delete account" (full width), opening a confirmation sheet: `title-2` "Delete your account?", body "This permanently deletes your cases, saved lines and settings. It can't be undone.", text field "Type DELETE to confirm", destructive primary "Delete everything", ghost "Keep my account".
6. `fine` footer: disclaimer from config and app version.

**Components**: list rows, avatar, sheet, slider, segmented control, switch, buttons, text field.

**States**
- Empty: not applicable; defaults are pace 1.0x, Sharp, speak replies on, recommended voice per persona.
- Loading: account rows show skeleton text; delivery controls are local and render immediately.
- Error: save failed (settings sync): toast "Couldn't save that. We'll keep trying." and keep the local value. Delete failed: danger banner in the sheet "Couldn't delete your account. Try again or contact support."
- Offline: delivery settings change locally and sync later; voice previews disabled unless cached; sign out works locally; delete account disabled with "Needs a connection".

## 13. Daily usage limit reached

**Purpose**: end the day gracefully, keep the user's goodwill and show what still works.

**Layout**: persona tint of the current persona. Centred: xl avatar with no halo, a clock-like mono countdown "RESETS IN 06:42:10". `title-1` serif persona line from config, for Harvey: "That's a full day of billable hours." `small` muted: "You've used all 10 consults for today. They reset at midnight, your time. Everything you've saved is still here." Primary "Open saved lines", secondary "Read past cases", text button "Notify me at reset" (schedules a local notification if permission exists). Talk button on home shows the disabled state until reset.

**Components**: avatar, countdown, buttons.

**States**
- Empty: not applicable.
- Loading: if the server has not confirmed the count, show the screen with the countdown replaced by "Checking your usage" and dots.
- Error: if the count cannot be verified, let the consult proceed (fail open on the client; the server enforces the limit).
- Offline: same screen; buttons go to cached content.

---

## State coverage at a glance

| Screen | Empty | Loading | Error | Offline |
|---|---|---|---|---|
| Splash | n/a | itself | session restore failed | cached session or sign in |
| Onboarding 1 to 3 | defaults | static demo, prompt dots | preview fail, mic denied | works, previews cached |
| Sign in | disabled CTA | button dots | invalid, send fail, expired | disabled with banner |
| Home | example card | skeleton rows | cases banner | drafts only, cached cases |
| Voice mode | "Go ahead" prompt | thinking | mic denied, consult fail, TTS fail | cannot open |
| Consult result | deleted case | card overlay, skeleton cards | banners with Retry; safety mode | replay only |
| Case history | no cases, no results | skeleton rows | banner | cached, search local |
| Case detail | n/a | skeleton turns | failed reply card | read only |
| Saved lines | nothing saved | skeleton cards | banner | full |
| Settings | defaults | account skeleton | save fail, delete fail | local changes |
| Limit | n/a | checking | fail open | same |
