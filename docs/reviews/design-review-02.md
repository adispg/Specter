# Design review 02

Reviewer: Product (PM). Date: 2026-10-25.
Scope: `docs/design/screens.md` (v1.2), `docs/design/mockups.html` (frames F01 to F29, all rendered at 390 by 844, real tokens, Bricolage Grotesque, Geist and Geist Mono loaded), `docs/design/design-system.md`.
Checked against: `docs/reviews/design-review-01.md` (all ten blockers and N5 from the non-blocker list).

## Verdict

**APPROVED.** All ten blockers from review 01 are resolved. N5 is fixed. No new blocking issues were introduced. Three new non-blocking observations are noted below.

---

## Blocker resolution (B1 to B10)

| # | Finding from review 01 | Resolved? | Evidence |
|---|---|---|---|
| B1 | Pause marks rendered as bars | Yes | CSS `.beat` and `.beat--long` draw circular dots on the baseline (`.22em` width, `border-radius: 50%`, `vertical-align: .08em`). F02, F11, F12, F13, F17, F18, F20, F22, F25 all use them. The marks glow when active. Saved lines in F18 strip them to plain text. Nothing reads as a dash. |
| B2 | No 18+ gate or AI disclosure screen | Yes | F03 "Before we start" is a new step 2 of 3, cannot be skipped, shows sparkle, shield and phone icon rows, named local helpline (Tele-MANAS 14416), safety policy link, "I'm 18 or older" primary, "I'm under 18" ghost, and fine terms copy. F29 is a clean under-18 exit with helpline buttons. Both store `age_confirmed_at` and `disclosure_ack_at`. |
| B3 | No guest-first flow | Yes | First run ends at F22 (Home as guest) without requiring sign in. F14 "Keep this case?" sheet appears after the first reply, with Google, email and "Not now" options. The second new consult removes "Not now" per spec. Sign in (F05) is the returning-user route only. |
| B4 | Limit was daily, no paywall stub | Yes | F19 Settings shows "1 of 3 left this week", config-driven. F20 uses the correct template ("3 free consults this week, reset on Monday"). F21 paywall stub is a sheet with plan cards and a "Coming soon" primary behind the paywall flag. Spec note on care exemption is present in F20 figcaption. |
| B5 | Generic helplines, no care-in-voice spec | Yes | F27 care screen shows named helplines as large tappable rows with tel links (Tele-MANAS 14416, emergency 112, Other countries directory). No persona avatar, no chip, no intensity pill, neutral tint throughout. F10 figcaption and screens.md both confirm voice mode skips speaking state for care replies and transitions straight to F27 in the neutral voice. |
| B6 | No retention loop | Yes | F07 Home shows the debrief card with Used it, Partly, Didn't chips. F12 result shows "When is it happening?" row with Today, Tomorrow, This week, Pick a time chips under the line card. F16 Cases list shows the "Debrief" accent tag on relevant rows. F17 thread pins the moment row at the top. |
| B7 | Three different talk gestures | Yes | F08 mic priming sheet, F09 listening state and F22 guest Home all use the same copy: label "Tap to talk to {short}", sub-label "Tap again when you're done. Or type instead." No hold gesture appears anywhere. |
| B8 | No feedback controls, no unsave | Yes | F13 result shows the "Was this useful?" row with thumbs up and down. F15 shows the feedback sheet with reason chips (Too long, Off target, Not their voice, Unsafe, Other) and an optional note field. F18 Saved lines shows swipe-to-remove (red Remove panel) and an Undo toast. Overflow with Remove is present. |
| B9 | Follow-up destination undefined | Yes | F12 figcaption explicitly states "this screen shows only the first reply". F17 thread shows all follow-ups appended in order, with persona dividers. The "See Donna's take" chip correctly replaces "Ask Donna" once she has answered. Back from thread goes to Home. |
| B10 | No data export or privacy controls | Yes | F19 Settings has a Privacy group: Download my data (with chevron), Delete all cases (danger-coloured), Privacy policy, Safety policy. F28 delete account sheet includes a "Download my data first" text link. |

---

## N5 resolution

| # | Finding from review 01 | Resolved? | Evidence |
|---|---|---|---|
| N5 | Thinking status mixed case | Yes | F10 voice thinking state shows `<p class="small">Harvey is on it</p>` in sentence case. F24 typed result loading shows "Mike is on it" the same way. No screaming-caps status anywhere in the file. |

---

## New non-blocking findings

| # | Screen | Issue | Suggested fix |
|---|---|---|---|
| N17 | F22 guest Home | The "Your first consult is on us" hint is placed beside the "Try one" section header rather than under the talk button, as screens.md specifies. The placement is readable but breaks the spec. | Move the hint to a `small` line directly below the intensity pill, matching the screens.md description. |
| N18 | F22 guest Home | The quick situations chips row is absent. Screens.md says guest-first replaces only the recent cases row with the example card; the situations row should remain above it. The frame skips it entirely. | Add the situations chips row between the talk group and the "Try one" example card, consistent with the non-guest F07 layout. |
| N19 | F28 delete account sheet | The Privacy group shown behind the scrim in F28 has only three rows (Download my data, Delete all cases, Privacy policy) while F19 shows four (adding Safety policy). A minor inconsistency in what the background frame reveals. | Add the Safety policy row to the behind-scrim group in F28, or note in the figcaption that it is scrolled out of view. |

---

## Journey walkthrough

**First run:** Splash (F01) goes to Onboarding 1 What it is (F02, demo plays with beats), then Before we start (F03, cannot skip, 18+ and AI disclosure), then Meet the three (F04, persona selection, fan disclaimer present), then Home as guest (F22). The "Sign in" text button is visible in the top bar alongside the guest person icon.

**First voice consult as guest:** Tap talk button opens Mic priming sheet (F08) with correct copy and OS-prompt flow. Listening (F09) shows live transcript and single-gesture label. Thinking (F10) shows rotating phrase and sentence-case status. Speaking (F11) shows word lighting, baseline beats, "Tap anywhere to interrupt" and "See the full answer". After reply, result screen (F12) appears with the first reply, When is it happening? row and dock. Then the Keep this case? sheet (F14) with Not now.

**Follow-up and thread:** Dock or voice push back appends to the thread (F17). Thread shows persona dividers, Ask chips and See-take chips for already-answered personas. Composer defaults to the latest persona. Show more expands cards in place.

**Retention loop:** Home shows debrief card (F07) once a moment passes unanswered. Cases list shows Debrief tag (F16). Thread pins the moment row (F17). Debrief chips answer inline.

**Limit hit:** Allowance screen (F20) uses config template, shows follow-ups still available, and care-mode exemption note. See plans opens the paywall stub sheet (F21) behind the flag.

**Care mode:** Reached from typed consult, from voice (skips speaking state), or from pre-screen. F27 is neutral-tint, no persona chrome, named helplines as large tappable rows. Offline: tel links still work.

**Delete account:** Settings (F19, F28) Privacy group, Download my data first link on the sheet, typed confirmation. After deletion: splash then onboarding with toast.

---

## Standing non-blocker tracking (review 01 items not yet confirmed fixed)

The following items from review 01 were not specifically checked as blockers but were left for the designer to fix cheaply or log. They are not included in this sign-off gate. They remain open for the next milestone:

N6, N7, N8, N9, N10, N11, N12, N13, N14, N15, N16 were all addressed in the revised screens.md and several appear resolved in the mockups (N7 profile button is in F07 and F19; N8 sample user is Sam throughout; N9 two-button duo row appears in F13; N10 notify button is absent; N11 documented in screens.md; N15 chipsfade class is on all chips rows). A formal non-blocker sweep is recommended before handoff to engineering.

---

## Sign-off

APPROVED. B1 through B10 are resolved. N5 is resolved. Three new non-blocking observations (N17, N18, N19) are noted and should be addressed before handoff to engineering, but they do not block QA entry.
