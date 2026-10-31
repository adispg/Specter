# Specter PM Review 02

Author: PM Agent (v2, accumulated session experience)
Date: 26 October 2026
Status: For founder review. This is not a compliment. It is a diagnosis.

---

## 1. Product Health Check

### What is working and can be demoed today

The core loop is live and fast enough. Guest sign-in works. A user arrives, types a situation, picks a persona, gets a structured reply in about 9 seconds, can save the line, and share it without their situation appearing in the share. All five modes (persona, care, decline, meta, clarify) fire correctly. Deepgram Aura speaks for all three personas on Android, the platform that was broken for most of the build. The share card exists and carries only line plus principle, no character name, Specter branding only. That is the minimum viable demo.

### What would embarrass at demo

**The welcome screen.** Every colleague the founder shows this to lands on the welcome screen first. It has not been redesigned. The home screen is polished; the entry point is not. This is the first impression for everyone who did not build it.

**The cases screen.** It has an unidentified server exception. It is contained by an error boundary so it does not crash the app, but it means the history feature is unreliable. If the demo involves showing a colleague a previous conversation, this will fail.

**No monitoring.** If a model is dead or Deepgram is down during the demo, the team finds out when the founder's colleague types something and nothing happens. There is no alert, no log, no dashboard. A dead model looked like a rate limit for an hour during this build session.

**The vent intent does not exist.** The founder's own stated use case. He spent a Sunday and three sessions of tokens building this app, and the thing he wanted to show a colleague was the one-liner that makes that story funny. The app cannot generate that. It will produce a three-play action plan for the situation of building an app all Sunday. That is the wrong answer.

**Four dead API routes.** Delete account, data export, delete all cases, delete saved line all exist in the codebase and are reachable by URL, but no button or link in the UI points to them. If a user wants to export or delete their data, they cannot. This is a GDPR affordance that is built and invisible.

### What is not a problem for Monday

Latency is acceptable for a demo (9.2s). Voice works. The thread renders. The share card works. The harness passes. The unit tests pass.

---

## 2. Harness Gap Analysis

### What the 63 scenarios do and do not cover

The current harness is strong on the reply contract and weak on product intent. It proves the JSON validates, mode fires correctly, safety gates hold, and the model does not invent facts or quote the show. It does not and cannot test whether a reply is the kind of thing someone forwards to a colleague, whether the wit lands, or whether the tone matches a low-stakes irritation versus a genuine crisis.

**Intent coverage gaps:**

| Intent | Scenarios | Notes |
|---|---|---|
| vent | 0 | Highest value gap. The founder's use case. Nothing tests this. |
| clarify (thin input) | 0 dedicated | Four meta scenarios test meta mode; clarify mode has no dedicated thin-input cases |
| rebuild_confidence | 4 | Underserved given how often the target user is in this state post-rejection or post-pass-over |
| low_stakes (boredom, mild annoyance) | 0 | The new product direction requires this. The app should handle "my standup was pointless" with lightness, not a battle plan. |
| share_moment | 0 | The "give me the line for this story" case has no test coverage at all |

**Missing structural tests:**

- Anti-sycophancy: one scenario where the model pushes back exists but it is not explicit in the scenario metadata
- Low-stakes register match: no test that a trivial irritation stays light and does not inflate into a crisis frame
- Consecutive-reply variety: no harness check that the same persona does not open the same way twice in the same thread

### Five new scenario stubs for the vent intent

These belong in `harness/situations.json` as a new `vent` intent category.

```json
{
  "id": "vent-001",
  "situation": "I spent my entire Sunday building a side project and it still does not work. My friend asked how the weekend was and I have to explain I watched a loading spinner for eight hours.",
  "intent": "vent",
  "stakes": "low",
  "personas": ["closer", "prodigy", "insider"],
  "expected_outcome": "A single sharp, funny line the user can say to their friend. No action plan. No advice. The reply should make them feel accurately read.",
  "expected_mode": "persona",
  "must": [
    "reply.line contains a single quotable observation about the situation",
    "reply.read acknowledges the specific absurdity without inflating it",
    "reply.play.length === 0 OR play items are light and optional, not a battle plan",
    "reply does not begin with advice about what to do differently next time"
  ],
  "must_not": [
    "reply.line sounds like a productivity tip",
    "reply.play contains steps like 'set a time limit' or 'take breaks'",
    "reply inflates a lost Sunday into a narrative about resilience or growth"
  ]
},
{
  "id": "vent-002",
  "situation": "My manager sent me a three paragraph Slack message asking me to 'circle back' and 'ideate on synergies' for a meeting that could have been an email.",
  "intent": "vent",
  "stakes": "low",
  "personas": ["closer", "prodigy", "insider"],
  "expected_outcome": "The line that makes a colleague laugh when the user forwards it.",
  "expected_mode": "persona",
  "must": [
    "reply.line is something the user would actually say out loud to a colleague",
    "reply.read skewers the corporate language accurately",
    "wit is in read or line, not in the play"
  ],
  "must_not": [
    "reply suggests how to respond to the manager",
    "reply treats this as a serious workplace conflict",
    "reply uses the phrase 'boundaries' or 'communicate your concerns'"
  ]
},
{
  "id": "vent-003",
  "situation": "The quarterly all-hands just ended. Forty-five minutes of slides to explain that we are 'cautiously optimistic' and 'leaning into headwinds'. I still do not know if I have a job.",
  "intent": "vent",
  "stakes": "medium",
  "personas": ["closer", "prodigy", "insider"],
  "expected_outcome": "The read that makes the user feel like someone finally said the obvious thing out loud.",
  "expected_mode": "persona",
  "must": [
    "reply.read names what the company actually communicated versus what it said",
    "reply.line is quotable and darkly accurate",
    "reply.principle is useful if the user does want to act later"
  ],
  "must_not": [
    "reply pretends the all-hands was informative",
    "reply gives a 3-step plan for navigating corporate uncertainty",
    "reply sounds like a LinkedIn post about adversity"
  ]
},
{
  "id": "vent-004",
  "situation": "I wrote the entire team proposal. My lead presented it. She said 'we' twelve times. No one asked who wrote it.",
  "intent": "vent",
  "stakes": "medium",
  "personas": ["closer", "prodigy", "insider"],
  "expected_outcome": "The line that validates how the user feels without manufacturing a crisis.",
  "expected_mode": "persona",
  "must": [
    "reply.line captures the specific feeling of invisible work",
    "reply.read names the dynamic accurately without dramatising it",
    "reply offers at least one light play if the user wants to act, framed as optional"
  ],
  "must_not": [
    "reply opens with 'I see you' or any empathy opener",
    "reply escalates to HR immediately",
    "reply calls this credit theft in the first line"
  ]
},
{
  "id": "vent-005",
  "situation": "It is 4:58 PM on a Friday. Someone just pinged me asking if I have five minutes to jump on a call.",
  "intent": "vent",
  "stakes": "low",
  "personas": ["closer", "prodigy", "insider"],
  "expected_outcome": "The one-liner that says exactly what every working person thinks in that moment.",
  "expected_mode": "persona",
  "must": [
    "reply.line is short, dry and accurate",
    "reply.read names the social dynamic of the Friday 5pm ping",
    "reply does not give advice on whether to take the call"
  ],
  "must_not": [
    "reply suggests 'setting boundaries around your time'",
    "reply is longer than one short paragraph total",
    "reply sounds like it was written by a productivity coach"
  ]
}
```

### Three additional thin-input scenarios for clarify mode

```json
{
  "id": "clarify-001",
  "situation": "My boss.",
  "intent": "clarify",
  "stakes": "unknown",
  "expected_mode": "clarify",
  "must": ["reply.play contains at least one question asking what happened or what the user wants to do"],
  "must_not": ["reply gives a three-step plan with no information"]
},
{
  "id": "clarify-002",
  "situation": "What do I do.",
  "intent": "clarify",
  "stakes": "unknown",
  "expected_mode": "clarify",
  "must": ["reply.play[0] is a question not a step"],
  "must_not": ["reply.mode === 'persona'"]
},
{
  "id": "clarify-003",
  "situation": "Work is just",
  "intent": "clarify",
  "stakes": "unknown",
  "expected_mode": "clarify",
  "must": ["reply asks what specifically is happening"],
  "must_not": ["reply treats this as a rebuild_confidence case", "reply gives advice"]
}
```

---

## 3. Spec vs Built Audit

Items specified in PRD section 4 and 6 that were never built:

| Item | Spec location | Status | Blocking? |
|---|---|---|---|
| First-run journey (splash, age gate, disclosure, persona pick) | PRD 6.1 | Not built. Users land directly on the composer. | No age gate exists. Disclosure is absent. |
| Talk button (mic on home composer) | PRD 6.1 step 4 | Mic exists in the composer, but the PRD describes a dedicated mic/talk button distinct from text input | Partial. Mic button exists. |
| Example chips on composer (intent-based starters) | PRD 6.1 step 4 | Starters are implemented. Intent-based routing (starters map to specific intents) is not. | Starters are generic, not intent-mapped. |
| Microphone permission requested on first mic tap only | PRD 6.1 step 4 | Not verified. Permission may be requested on page load. | Unknown without testing. |
| Recent cases on home screen | PRD 4 | Not built. Home screen has no case history. | Users cannot see recent conversations without navigating to Cases. |
| Debrief card after moment_at time passes | PRD 6.7 | Not built. The moment_at field exists in schema but the debrief card never appears. | The "How did it go?" loop is entirely absent. |
| Intensity picker in onboarding | PRD 6.1 | Not in onboarding. Intensity is in Settings only. | Users never learn it exists. |
| Save prompt after first reply (sign-in nudge) | PRD 6.1 step 5 | Not built. No sign-in prompt appears after the first consult. | Guest conversion path is absent. |
| Share line as plain text with "via Specter" suffix | PRD 6.8 | Share card exists. "via Specter" suffix not verified. | Minor. |
| Filter saved lines by persona | PRD 6.8 | Not verified. Saved lines view may have no filter. | Minor but specified. |
| Read play aloud toggle | PRD 6.9 | Not verified. Only line and followup are spoken by default. The toggle for reading the play aloud is in the spec but not confirmed built. | Unknown. |
| Data export (JSON) | PRD 4 | Route exists at /api/account/export. No UI button anywhere. | GDPR affordance invisible. |
| Delete all cases | PRD 4 | Route exists at /api/cases/all. No UI. | Same. |
| Delete saved line | PRD 4 | Route exists at /api/saved/[id]. No UI confirmed. | Same. |
| Delete account | PRD 4 | Route exists at /api/account. No UI confirmed. | Same. |
| Locale-aware helplines in Care mode | PRD 4 | Reply schema supports it. Implementation not verified. | Safety item. |
| Weekly free tier with paywall stub | PRD 4 | Quota logic exists. Paywall stub not built. | Not blocking MVP. |
| Debrief summary shown to persona on re-open | PRD 6.7 | Debrief does not exist, so this cannot be built. | Downstream of debrief. |

**The pattern.** Seven of the fourteen missing items involve connecting built backend logic to UI that was never wired. The data export route was built. The button was not. The debrief field exists in schema. The card was not built. Reading the source confirms the work was done. Clicking confirms it cannot be reached.

---

## 4. The Vent Intent: Full Spec

### What it is

The vent intent handles input where the user is not asking for a plan. They have something to say about what just happened. They want to feel accurately read and have something worth repeating. This is not the same as rebuild_confidence (which is about the user's own doubt). It is about a situation that was absurd, unfair or plainly stupid, and the user wants the line that names it.

The founder's framing: "I spent my entire Sunday on this app. I want the one-liner that makes that story funny when I tell a colleague."

### What triggers it

The intent classifier (the model) should route to vent when:
- The input describes something that already happened, not something coming up
- There is no decision to make and no imminent moment to prepare for
- The stakes are low to medium (not a firing, not a legal matter, not a crisis)
- The tone of the input is exasperated, dry or resigned rather than anxious

Vent does not conflict with any existing mode. It is a persona-mode reply with a different reply contract.

### Reply structure for vent (different from standard persona)

The standard persona format requires three executable plays and an avoid. For vent, this is wrong. A user who wants the line that names their Sunday does not want steps two through four of a productivity intervention.

**Proposed vent contract:**

```
mode: "persona"   // same mode, different shape controlled by intent
line: string      // the one thing worth saying out loud. Dry, sharp, accurate. Not advice.
followup: string  // the thing that makes the line land. What it actually means. One beat.
read: string      // the diagnosis. This is where the wit goes. Name the absurdity precisely.
play: []          // empty, or one optional light item framed as "if you want to act". Never three steps.
avoid: string     // one thing they should not do. Often: "turning this into a longer story than it already is."
principle: string // the one-line truth. This is the share card. Short enough to say at a desk.
```

The key change is `play` is optional and light for vent, not three mandatory executable steps. This requires a schema change: allow `play` to have 0 items when the intent is detected as vent. Alternatively, the prompt instructs the model to make the three plays light and optional in tone when intent is vent, which requires no schema change.

**Recommended implementation:** prompt-level instruction first. Add to `COMMON_RULES` under a new `VENT AND LOW STAKES` section. If harness results show the model ignoring it, then enforce at schema level.

### Example inputs and outputs

**Input:** "I spent my whole Sunday building a side project. It still doesn't work. My friend asked how my weekend was."

**Expected output:**
```json
{
  "mode": "persona",
  "line": "Great. I debugged a loading spinner for eight hours and I have nothing to show for it but strong opinions about error messages.",
  "followup": "That is a full Sunday.",
  "read": "You did not waste your Sunday. You paid tuition. The receipt just has no line for 'returned item'.",
  "play": [
    { "move": "Tell your friend exactly that", "detail": "It is funnier the second time." }
  ],
  "avoid": "Calling it productive. It was not productive. It was interesting. There is a difference.",
  "principle": "The cost of learning is always paid in advance."
}
```

**Input:** "My manager used the phrase 'let's take this offline' four times in one meeting. About things that were already offline."

**Expected output:**
```json
{
  "mode": "persona",
  "line": "He said 'let's take this offline' about the thing you were already discussing in private. Language has left the building.",
  "followup": "This is what happens when communication becomes a performance.",
  "read": "The meeting was not a meeting. It was a costume. 'Take this offline' means 'I do not want to answer this here', which means the answer is not great.",
  "play": [
    { "move": "Note what never made it online", "detail": "That is your actual agenda." }
  ],
  "avoid": "Expecting the offline conversation to be more useful than the one you just left.",
  "principle": "Jargon is the price of having nothing to say."
}
```

### How the share card connects

The share card already exists and carries `line` plus `principle`, no character name, Specter branding only. For vent replies, `principle` is the natural share unit: "The cost of learning is always paid in advance." This stands alone with no context needed. The recipient supplies their own failed Sunday.

No share card changes are needed. The vent intent plugs directly into the existing share mechanic. This is the feature that makes the app travel between desks.

### Implementation

1. Add `vent` to `INTENT_KEYS` in `lib/personas/rules.ts` with hint: "something absurd or unfair already happened: name it accurately, give the line worth repeating, keep plays light or absent"
2. Add `VENT AND LOW STAKES` section to `COMMON_RULES`: "When the intent is vent, the user wants the read and the line, not the plan. One light play at most, framed as optional. Match their register. Do not inflate a mild irritation into a career narrative."
3. Add 5 vent scenarios to `harness/situations.json` (stubs above)
4. Add harness checks: vent cases should not have `play.length === 3` with prescriptive steps; `line` should not begin with "You should" or "First,"

---

## 5. Next 3 Sprints

### Sprint 1: Make the demo not embarrassing (3 days)

**Goal:** A founder can show this to a colleague without a pre-briefing about what not to tap.

1. **Vent intent** (2 days): Rules change + harness scenarios. This is the founder's use case and it is a prompt change, not an architecture change. Do this first.
2. **Welcome screen** (0.5 days): Redesign to match the home screen quality. The entry point is the first impression.
3. **Cases screen fix** (0.5 days): Identify and fix the server exception. If it cannot be fixed quickly, add a message that degrades gracefully rather than silently failing.

**Do not start:** monitoring, GDPR routes, debrief card. Not for the demo.

### Sprint 2: Close the spec gaps that matter (1 week)

**Goal:** The product does what it said it would do for the features users will actually touch.

1. **Sign-in nudge after first consult** (0.5 days): The guest conversion path. Without this, guests have no reason to sign in and the case is lost when they close the tab.
2. **First-run journey** (1 day): Age gate + disclosure + persona pick with voice sample. The PRD specifies this. It is not built. It is a legal and product obligation.
3. **GDPR UI** (1 day): Wire the four dead API routes to buttons in Settings. Data export, delete account, delete all cases. These are built. Add the buttons.
4. **Monitoring** (1 day): Vercel runtime logs are not enough. Add structured logging on consult start, model response, and error. Sentry or a simple `/api/health` endpoint checked by an uptime monitor. A dead model must not look like a rate limit.
5. **Clarify scenarios** (0.5 days): Three thin-input cases in the harness. The mode exists. No tests verify it fires on the right inputs.

### Sprint 3: Quality and depth (2 weeks)

**Goal:** The product is worth returning to after the first consult.

1. **Debrief card**: The "How did it go?" loop. This is the only feedback mechanism that tells the persona what the user actually did. It is in the PRD. It was never built.
2. **Recent cases on home**: A user returning to the app should see their last two or three cases. Currently the home screen has no history and the Cases tab requires navigation.
3. **Rebuild confidence intent expansion**: Four harness scenarios is not enough coverage for the most emotionally charged intent category. Write 6 more with varying stakes and entry points.
4. **Latency investigation**: 6 seconds of non-model time is now logged per phase. Read the logs and measure before changing anything.
5. **Low-stakes register calibration**: Add a `low_stakes` scenario set and a harness check that the reply does not open with crisis-register language when the input is mild.

---

## 6. The PM's Honest Verdict

This app has a real product in it. The reply structure is genuinely good. The line plus the read plus the principle is the right shape for what the user is feeling in the bad-meeting moment. The share card shipping is the most important thing that happened in this build session.

The problem is that the product was built for the crisis case and the founder realised it should be for every case. That realization came late. The reply modes, the harness scenarios, the intent taxonomy: they are all tuned for "I have a meeting tomorrow that could go badly." The vent case, the bored case, the absurd case: none of them have test coverage, and the prompt does not explicitly handle them.

The second problem is that too much was built and not connected. The delete account route, the data export route, the debrief card fields, the save prompt after first consult. These are the visible signs of a product where engineering scope and product scope drifted. A user cannot find the things that were built. That is a PM failure, not an engineering one.

What this product needs to be worth opening when you are not in a crisis:

1. The vent intent, which turns the app from a coach into a companion for the annoying moment.
2. The welcome screen, which gives a first-time user a reason to trust it before they type anything.
3. One feature that brings a user back the next day. Currently that feature does not exist. Saved lines are close but passive. The debrief card, when built, creates a reason to return: the app asked you how the meeting went, and you want to tell it.

The product is ready for a demo. It is not yet ready for a second session from a new user. That is the next thing to build.

---

*Review written 26 October 2026. Next review: after Sprint 1 ships, before expanding to new users.*
