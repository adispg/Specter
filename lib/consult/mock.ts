import { personaList, type PersonaId } from "@/lib/personas/config";
import { systemText, type ChatTurn } from "@/lib/personas/prompt";
import type { Completion, CompletionRequest, LlmClient } from "./llm";
import type { Reply } from "./schema";

/**
 * Deterministic fixtures for MOCK_AI=1. The mock client returns JSON text, so the
 * real parse, validate and scrub path runs exactly as with the live model. Variant
 * choice depends only on the persona and the thread, never on randomness.
 */
type Fixture = Pick<Reply, "matter" | "principle" | "line" | "followup" | "read" | "avoid" | "hours"> & { play: [string, string, string] };

/**
 * care, meta and clarify carry no three move plan, so they get their own shape:
 * play holds nought to three items and principle and avoid may be empty.
 */
type LightFixture = Pick<Reply, "matter" | "principle" | "line" | "followup" | "read" | "avoid" | "hours"> & { play: string[] };

const FIXTURES: Record<PersonaId, { fresh: Fixture[]; followup: Fixture }> = {
  closer: {
    fresh: [
      {
        matter: "Who holds the leverage",
        principle: "Leverage is a decision",
        line: "You think they're holding all the cards. || They're holding a bluff. | Call it.",
        followup:
          "Walk in knowing what you'll walk away from, | and let them see that you know. || People fold fast | when they realise you already have.",
        read: "You're treating this as a favour you need, when it is a deal they need too. The moment you act like it, the room changes.",
        play: [
          "Write down your walk-away point tonight and don't move it in the room.",
          "Open with what they lose if this falls through, in one calm sentence.",
          "When they push, say: 'That doesn't work for me. What else have you got?' and wait.",
        ],
        avoid: "Filling the silence with reasons, because every reason is a discount.",
        hours: 0.3,
      },
      {
        matter: "Take back the room",
        principle: "Composure is the opening offer",
        line: "Nobody remembers who talked the most. || They remember who never blinked.",
        followup:
          "Slow down, | say less, | and make them come to you. || The person in a hurry | is the person who loses.",
        read: "You're reacting to their pace. Set your own and they'll have to match it.",
        play: [
          "Before you reply to anything, wait a full breath and lower your voice.",
          "Ask one precise question that shows you've already done the maths.",
          "End the meeting yourself, with a clear next step that you own.",
        ],
        avoid: "Apologising for asking for what you're worth.",
        hours: 0.2,
      },
      {
        matter: "Close it this week",
        principle: "Deadlines belong to the closer",
        line: "Stop waiting for the right moment. || The right moment is the one you set.",
        followup: "Put a date on it today | and say it out loud. || Then make missing it | their problem, not yours.",
        read: "This has drifted because nobody owns the clock. Owning it is half the win.",
        play: [
          "Send a short note proposing a decision date this week.",
          "List the two objections they'll raise and answer both before they do.",
          "On the day, ask for the yes directly: 'Are we doing this?'",
        ],
        avoid: "Letting 'let's circle back' become the plan.",
        hours: 0.4,
      },
    ],
    followup: {
      matter: "The plan, adjusted",
      principle: "New facts, same spine",
      line: "Good. || Now we know what we're really dealing with. | That's leverage.",
      followup: "Use what you just told me | before they realise you know it. || Timing is the whole game.",
      read: "That detail changes the shape of the problem, not who should win it.",
      play: [
        "Lead with the new fact in your next conversation, framed as a question.",
        "Let them explain it. Their explanation tells you how worried they are.",
        "Then restate your ask, unchanged, as if the new fact settled it.",
      ],
      avoid: "Overplaying it, because a good card loses value every time you wave it around.",
      hours: 0.2,
    },
  },
  prodigy: {
    fresh: [
      {
        matter: "Find the overlooked clause",
        principle: "The answer is in the footnotes",
        line: "Everyone read the headline. | Nobody read page four. || Read page four.",
        followup:
          "Go back to the email, the contract, the original ask, | whatever started this. || The thing that saves you | is usually already written down.",
        read: "This looks like a people problem, but there is a paper trail, and it probably favours you.",
        play: [
          "Pull every message and document about this into one folder tonight.",
          "Highlight the one line that sets the expectation everyone forgot.",
          "Bring it up as a question: 'Can we check what we agreed here?'",
        ],
        avoid: "Arguing from memory when you could argue from the record.",
        hours: 0.4,
      },
      {
        matter: "Outwork the doubt",
        principle: "Homework is a superpower",
        line: "You don't need to be the smartest person there. | You need to be the most prepared. || That part's easy.",
        followup: "Spend two hours where they'd spend twenty minutes. || By the end of the week | you'll know more than the room.",
        read: "The gap you're worried about is smaller than it feels, and it closes with focused prep.",
        play: [
          "List the five questions you'd least like to be asked, and answer each in writing.",
          "Find one example of someone who solved this exact problem and study how.",
          "Rehearse your opening out loud twice, actually out loud, not in your head.",
        ],
        avoid: "Winging the part you're nervous about.",
        hours: 0.3,
      },
      {
        matter: "Try the side door",
        principle: "Every lock has a window",
        line: "If the front door's shut, | stop knocking. || Check the windows.",
        followup: "Find the one person who can say yes without a meeting. || Then make it easy for them to say it.",
        read: "You're going through the official route that was built to say no. There's a shorter path.",
        play: [
          "Map who actually decides, not who's on the org chart.",
          "Write a three-line proposal that person can forward without editing.",
          "Offer a small trial that costs them nothing to approve.",
        ],
        avoid: "Going around anyone in a way you'd be embarrassed to explain later.",
        hours: 0.3,
      },
    ],
    followup: {
      matter: "Revised angle",
      principle: "Update the model, keep moving",
      line: "Okay, | that's new. || And honestly? | It helps us.",
      followup: "That detail is the precedent you were missing. || Build the next step around it.",
      read: "What you just added explains why the first approach felt stuck.",
      play: [
        "Write the new detail into one sentence you can say calmly.",
        "Test it with one trusted person before you use it in the room.",
        "Use it to reframe the ask, not to win the argument.",
      ],
      avoid: "Burying the new fact under an apology.",
      hours: 0.2,
    },
  },
  insider: {
    fresh: [
      {
        matter: "Read the real feeling",
        principle: "Name it before it names you",
        line: "You're not annoyed. | You're hurt. || And they can tell the difference, | so let's use it.",
        followup:
          "Say the true thing once, | kindly, | to the right person. || Then act like it's already handled.",
        read: "You're worried that speaking up makes you look small. Staying silent is what actually does that.",
        play: [
          "Pick the one person whose opinion matters most and get ten minutes with them this week.",
          "Open with what you want next, not with what went wrong.",
          "Follow up in writing the same day, warm and short.",
        ],
        avoid: "Venting to the group chat first, because it always gets back.",
        hours: 0.2,
      },
      {
        matter: "Win the room early",
        principle: "Relationships beat rebuttals",
        line: "The meeting is decided | before anyone sits down. || Be in the hallway first.",
        followup: "Have the coffee, | ask about their weekend, | mention your idea last. || By the time it's on the agenda, | it's already theirs too.",
        read: "You're preparing slides when you should be preparing people.",
        play: [
          "Talk to the two most influential people individually before the meeting.",
          "Ask each of them what would make this a yes for them.",
          "In the meeting, credit their input out loud.",
        ],
        avoid: "Letting anyone be surprised in public.",
        hours: 0.2,
      },
      {
        matter: "Set the boundary gracefully",
        principle: "Kind and clear, never vague",
        line: "You can say no | and still be the nicest person in the building. || I do it every day.",
        followup: "Say no to the task, | yes to the person. || And never explain more than once.",
        read: "You've been saying yes to avoid friction, and now the yeses are the friction.",
        play: [
          "Decide what you're declining before the conversation starts.",
          "Say: 'I can't take this on, but here's what I can do.'",
          "Offer one small alternative and stop there.",
        ],
        avoid: "Apologising three times, when once is gracious and three times is negotiable.",
        hours: 0.2,
      },
    ],
    followup: {
      matter: "Recalibrated",
      principle: "I knew there was more",
      line: "There it is. || That's what this was really about.",
      followup: "Now that it's out, | you can stop guarding it. || Lead with it next time.",
      read: "The extra detail tells me this is about trust, not the task.",
      play: [
        "Acknowledge that detail directly with the person involved.",
        "Ask them what they need from you to move on.",
        "Agree on one small thing you'll each do this week.",
      ],
      avoid: "Pretending you didn't notice. They'll know you did.",
      hours: 0.2,
    },
  },
};

const DECLINE: Record<PersonaId, Fixture> = {
  closer: {
    matter: "The legal way to win",
    principle: "Real leverage leaves no fingerprints",
    line: "Not that move. || It hands them the win. | Here's the one that holds up.",
    followup: "Get your facts on paper | and let a professional make the threat for you. || Pressure that survives daylight | is the only kind that works.",
    read: "You want them to pay for what they did, and you want control back. That's fair; the tactic you picked would cost you both.",
    play: [
      "Write down every fact you can prove, with dates, in one document tonight.",
      "Book a consultation with a lawyer or the right authority where you live this week.",
      "Until then, say nothing to them in writing that you wouldn't want read aloud.",
    ],
    avoid: "Doing anything you'd have to explain to a judge.",
    hours: 0.3,
  },
  prodigy: {
    matter: "The lawful route",
    principle: "The record beats the shortcut",
    line: "That shortcut is the part that gets you caught. | The paper trail, || that's the window.",
    followup: "Everything you need is probably already documented somewhere legal. || Find it, | and let the process do the work.",
    read: "The goal underneath is fairness, and there is usually a legitimate route to it that is stronger than the one you asked about.",
    play: [
      "List what happened in order, with the documents or messages that prove each step.",
      "Look up the formal process that covers this: a policy, a regulator, a lawyer, or the platform's own reporting.",
      "Use that route and keep copies of everything you send.",
    ],
    avoid: "Touching anything that isn't yours to access.",
    hours: 0.3,
  },
  insider: {
    matter: "Win it the right way",
    principle: "Grace is the stronger revenge",
    line: "I know you want them to feel it. || Let them feel it watching you win.",
    followup: "Take the hurt to someone who can actually help, | not to the internet. || And let your next move be so good | they hear about it.",
    read: "You're hurt and humiliated, and you want the scales balanced. That feeling is real; acting on it this way would make you the story.",
    play: [
      "Tell one trusted friend the whole thing tonight so it stops living only in your head.",
      "Take the legitimate route: a lawyer, HR, or the right authority, depending on what happened.",
      "Block, mute, and step back from the person while that runs its course.",
    ],
    avoid: "Sending the message you've already drafted.",
    hours: 0.2,
  },
};

/**
 * Care mode. The persona is dropped completely: no marks, no wit, no billing.
 * Two variants because the two crisis shapes in the rubric owe different things:
 * self harm risk owes distance from the means, violence at home owes "not your
 * fault" and never a script for managing his anger.
 */
const CARE: Record<"selfHarm" | "violence", LightFixture> = {
  selfHarm: {
    matter: "Your safety first",
    principle: "",
    line: "What you just said matters, and I am glad you said it out loud.",
    followup:
      "You deserve real support right now, not tactics. Please contact your local emergency number or a crisis line before anything else.",
    read: "Losing work and feeling like a burden can arrive together, and that is a heavy combination. It does not make the thought true.",
    play: [
      "Call your local emergency number or a crisis helpline now, before anything else.",
      "Put the pills somewhere you cannot reach easily, or hand them to someone you trust.",
      "Call or message one person you trust and tell them you should not be alone tonight.",
    ],
    avoid: "",
    hours: 0,
  },
  violence: {
    matter: "Your safety comes first",
    principle: "",
    line: "Being hit is not your fault, and there is no question you could have asked differently.",
    followup:
      "I am not going to help you manage his anger, because his anger is not yours to manage. Please speak to someone trained in this today.",
    read: "He has hurt you more than once and promised it would stop. Your safety comes before any conversation with him.",
    play: [
      "If you are in danger right now, call your local emergency number.",
      "Contact a domestic violence helpline or support service today, from a phone he cannot check.",
      "Tell one person you trust where you are, and agree somewhere you can go tonight.",
    ],
    avoid: "",
    hours: 0,
  },
};

/** meta: what this is and what to bring. No plan, no reading of their state. */
const META: Record<PersonaId, LightFixture> = {
  closer: {
    matter: "What this is",
    principle: "",
    line: "I do situations, not small talk. || Bring me the one that is costing you something.",
    followup:
      "Tell me what happened, | who else is in the room, | and what you want out of it. || I will tell you how to get it.",
    read: "You have a situation and you want a way through it. That is the whole service.",
    play: [
      "A negotiation where you do not know your walk away point.",
      "A person who keeps taking credit that is yours.",
      "A conversation tomorrow that you are already dreading.",
    ],
    avoid: "",
    hours: 0.1,
  },
  prodigy: {
    matter: "What this is",
    principle: "",
    line: "This is where you bring the thing you cannot work out. | I am good at those.",
    followup: "Give me the details, | even the ones that seem irrelevant. || Those are usually the ones that matter.",
    read: "You want to know what this does before you trust it with something real. Reasonable.",
    play: [
      "An email you have read nine times and still cannot answer.",
      "A deadline you agreed to and now regret.",
      "A manager who changed their mind and will not say so.",
    ],
    avoid: "",
    hours: 0.1,
  },
  insider: {
    matter: "What this is",
    principle: "",
    line: "You tell me what is going on, | and I tell you how to handle the people in it.",
    followup: "Start anywhere. || I will find the part that is actually bothering you.",
    read: "You are checking what this is before you hand over anything personal. Smart.",
    play: [
      "A colleague who is lovely to your face and not behind it.",
      "A message you have drafted four times and not sent.",
      "A room you need on your side by Monday.",
    ],
    avoid: "",
    hours: 0.1,
  },
};

/**
 * meta, identity variant. The rule in rules.ts is that the answer says plainly
 * it is an AI and then carries on, so the mock says it plainly too.
 */
const META_IDENTITY: Record<PersonaId, LightFixture> = {
  closer: {
    matter: "Who you are talking to",
    principle: "",
    line: "I am an AI voice built on an archetype. || The advice still works.",
    followup: "I am not a real person and not your lawyer. || Now, what is the situation?",
    read: "Fair question. You are talking to software written to think like a closer.",
    play: [],
    avoid: "",
    hours: 0.1,
  },
  prodigy: {
    matter: "Who you are talking to",
    principle: "",
    line: "I am an AI voice, | not a real lawyer. || Ask me anyway.",
    followup: "Nothing here is legal advice. | It is a way of thinking about your problem.",
    read: "I am software with a style. The style is borrowed; the thinking is yours to check.",
    play: [],
    avoid: "",
    hours: 0.1,
  },
  insider: {
    matter: "Who you are talking to",
    principle: "",
    line: "I am an AI, | and I am not going to pretend otherwise. || Still useful, though.",
    followup: "I am not a therapist and not a real person. | I am good at reading situations anyway.",
    read: "You wanted a straight answer. I am software, written to notice what people are doing.",
    play: [],
    avoid: "",
    hours: 0.1,
  },
};

/** clarify: a hypothesis, then the one to three facts that change the answer. */
const CLARIFY: Record<PersonaId, LightFixture> = {
  closer: {
    matter: "Not enough to work with",
    principle: "",
    line: "Something specific happened. || Tell me that, | not the summary.",
    followup: "I can read a room from the details. | I cannot read one from a verdict.",
    read: "My guess is one person and one recent moment, and the rest is the fallout.",
    play: [
      "What did they actually say or do, and when?",
      "Who else saw it happen?",
      "What do you want to be different by Friday?",
    ],
    avoid: "",
    hours: 0.1,
  },
  prodigy: {
    matter: "Need the details first",
    principle: "",
    line: "I could guess, | but a guess is how you end up with the wrong plan.",
    followup: "Tell me one specific thing that happened this week. || I will work from that.",
    read: "There is probably a single incident under this, and it is doing most of the work.",
    play: [
      "What happened most recently, and what were the exact words?",
      "How long has this been going on?",
      "Is there anything about it in writing?",
    ],
    avoid: "",
    hours: 0.1,
  },
  insider: {
    matter: "Tell me the real version",
    principle: "",
    line: "Something happened, | and you are giving me the headline. || Give me the scene.",
    followup: "I need one moment and one person. | Then I can tell you what is actually going on.",
    read: "My instinct is that this is about how someone made you feel, not about the work.",
    play: [
      "Who is it, and what did they do?",
      "When did it last happen?",
      "What would make this feel handled?",
    ],
    avoid: "",
    hours: 0.1,
  },
};

/**
 * Routing patterns. The live model decides mode by judgement; a fixture client
 * cannot, so these are coarse stand ins that cover the cases in
 * harness/situations.json. They keep MOCK_AI=1 honest about all five modes
 * instead of answering everything as persona.
 */
const SELF_HARM = [
  /\b(kill myself|end my life|take my own life|better off without me|do not want to be here|don't want to be here)\b/i,
  /\b(sleeping pills|overdose|hurt myself|self harm)\b/i,
];
const PARTNER_VIOLENCE = [
  /\b(hit|hits|beat|beats|punched|strangled|shoved) me\b/i,
  /\b(husband|wife|partner|boyfriend|girlfriend|father|mother|brother) (hit|hits|beat|beats|punched)\b/i,
];
const IDENTITY_ASK = [/\bare you (actually |really )?(a |an |the )?(ai|bot|robot|real|human|person|harvey|mike|donna|specter)\b/i];
const META_ASK = [
  /^(hi|hey|hello|yo|hiya|sup|heya|good (morning|afternoon|evening))\b/i,
  /\bwhat (can|do) you do\b/i,
  /\bwho are you\b/i,
  /\bhow does this (work|thing work)\b/i,
  /\bwhat is this( app)?\b/i,
  /\b(recipe|weather|cricket score|football score|capital of|translate this)\b/i,
  /^(test|testing)\b/i,
];

/**
 * The opening turn reaches the client wrapped by situationTurn in
 * lib/personas/prompt.ts ("THE USER'S SITUATION" then the text), so the wrapper
 * comes off before any pattern that anchors at the start of what the user typed.
 */
function userSituation(raw: string): string {
  const i = raw.indexOf("\n");
  return (raw.startsWith("THE USER'S SITUATION") && i >= 0 ? raw.slice(i + 1) : raw).trim();
}

/** Too thin to answer without inventing the facts underneath it. */
function isThin(situation: string): boolean {
  const words = situation.trim().split(/\s+/).filter(Boolean);
  return words.length <= 10 && !/\d/.test(situation);
}

const HARMFUL = [
  /\b(password|hack|get into (her|his|their) account|read (her|his) messages)\b/i,
  /\b(blackmail|ruin his marriage|ruin her marriage|leak (the )?photos)\b/i,
  /\b(slash|key) (his|her|their) (tyres|tires|car)\b/i,
  /\b(fake|forge|forged) (experience|letter|certificate|document|degree)\b/i,
  /\bwithout getting caught\b/i,
];

export const MOCK_TRANSCRIPT = "My manager took credit for my work in front of leadership and I don't know what to say tomorrow.";

function personaFromSystem(system: string): PersonaId {
  return personaList().find((p) => system.startsWith(p.bible.slice(0, 60)))?.id ?? "closer";
}

function guessIntent(text: string): Reply["intent"] {
  const t = text.toLowerCase();
  if (/offer|salary|rent|price|raise|lakh|negotiat/.test(t)) return "negotiate";
  if (/credit|visib|noticed/.test(t)) return "claim_credit";
  if (/interview|presenting|monday|speech|board/.test(t)) return "prepare";
  if (/should i|two offers|decide/.test(t)) return "decide";
  if (/let go|fire|bad news/.test(t)) return "deliver_bad_news";
  if (/resign|quit|leave/.test(t)) return "exit";
  if (/talk(s|ed)? over|crossed|keeps/.test(t)) return "confront";
  return "decide";
}

export function mockReplyFor(persona: PersonaId, messages: ChatTurn[]): Reply {
  const last = messages[messages.length - 1]?.content ?? "";
  const situation = userSituation(messages[0]?.content ?? "");
  const priorTakes = messages.filter((m) => m.role === "assistant").length;
  const all = messages.filter((m) => m.role === "user").map((m) => m.content).join("\n");
  const isFollowup = last.includes("Follow-up from the user:");

  // Same order the prompt applies: crisis, then out of bounds, then meta, then
  // too thin to answer. Only the opening turn is routed; once a thread is under
  // way the persona path owns it.
  if (!isFollowup) {
    if (SELF_HARM.some((re) => re.test(all))) return { mode: "care", ...CARE.selfHarm, intent: "crisis", stakes: "high" };
    if (PARTNER_VIOLENCE.some((re) => re.test(all))) return { mode: "care", ...CARE.violence, intent: "crisis", stakes: "high" };
  }
  if (HARMFUL.some((re) => re.test(all))) {
    return { mode: "decline", ...DECLINE[persona], intent: "harmful_request", stakes: "high" };
  }
  if (!isFollowup) {
    if (IDENTITY_ASK.some((re) => re.test(situation))) return { mode: "meta", ...META_IDENTITY[persona], intent: null, stakes: "low" };
    if (META_ASK.some((re) => re.test(situation))) return { mode: "meta", ...META[persona], intent: null, stakes: "low" };
    if (isThin(situation)) return { mode: "clarify", ...CLARIFY[persona], intent: guessIntent(situation), stakes: "medium" };
  }

  const set = FIXTURES[persona];
  const fixture = isFollowup ? set.followup : set.fresh[priorTakes % set.fresh.length]!;
  const { line, followup, matter, read, play, avoid, principle, hours } = fixture;
  return { mode: "persona", line, followup, matter, read, play, avoid, principle, intent: guessIntent(situation), stakes: "medium", hours };
}

export class MockLlmClient implements LlmClient {
  readonly model = "mock";
  /** Optional queue of raw outputs to return first (tests use it to exercise repair). */
  constructor(private readonly scripted: string[] = []) {}
  async complete(req: CompletionRequest): Promise<Completion> {
    const usage = { inputTokens: null, outputTokens: null, cacheReadTokens: null };
    const next = this.scripted.shift();
    if (next !== undefined) return { text: next, usage };
    const system = typeof req.system === "string" ? req.system : systemText(req.system);
    return { text: JSON.stringify(mockReplyFor(personaFromSystem(system), req.messages)), usage };
  }
}
