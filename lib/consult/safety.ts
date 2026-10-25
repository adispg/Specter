import type { Intensity } from "@/lib/personas/config";
import type { Reply } from "./schema";

/**
 * Cheap rules in front of the model (PRD 6.3: "safety pre-screen, cheap rules plus
 * the model's own mode"). The system prompt also tells the model to switch modes;
 * these catch the clear cases deterministically so they never depend on the model
 * and never consume quota.
 */

export type SafetyCategory = "crisis" | "self_harm" | "violence" | "abuse" | "minor_suspected" | "illegal_request";

const SELF_HARM: RegExp[] = [
  /\b(kill|hurt|harm|cut)(ing)?\s+my\s*self\b/i,
  /\bsuicid(e|al)\b/i,
  /\bend\s+(it\s+all|my\s+life)\b/i,
  /\b(want|wanna|going)\s+to\s+die\b/i,
  /\bdon'?t\s+want\s+to\s+(live|be\s+alive|wake\s+up)\b/i,
  /\bno\s+(reason|point)\s+(to|in)\s+(live|living|going\s+on)\b/i,
  /\bcan'?t\s+go\s+on\b/i,
  /\bself[-\s]?harm/i,
  /\boverdose\b/i,
  /\b(everyone|they|people)\s+(would\s+be|are)\s+better\s+off\s+without\s+me\b/i,
  /\bbetter\s+off\s+dead\b/i,
  /\blooking\s+at\s+my\s+(sleeping\s+)?pills\b/i,
];

const VIOLENCE_TO_USER: RegExp[] = [
  /\b(husband|wife|partner|boyfriend|girlfriend|father|mother|dad|mum|mom|brother|in-?law)\s+(hit|hits|beat|beats|slapped|slaps|punched|choked|kicked)\s+me\b/i,
  /\b(hit|beat|slapped|punched|choked|kicked)\s+me\s+again\b/i,
  /\bafraid\s+(he|she|they)\s+(will|might)\s+(hurt|kill)\s+me\b/i,
];

const HARM_OTHERS: RegExp[] = [/\b(want|going)\s+to\s+(kill|hurt|stab|shoot)\s+(him|her|them|my)\b/i];

/** Crisis signals: switch to care mode without calling the model. */
export function detectCrisis(text: string): SafetyCategory | null {
  if (!text) return null;
  if (SELF_HARM.some((re) => re.test(text))) return "self_harm";
  if (VIOLENCE_TO_USER.some((re) => re.test(text))) return "abuse";
  if (HARM_OTHERS.some((re) => re.test(text))) return "violence";
  return null;
}

const DISTRESS: RegExp[] = [
  /\b(died|passed\s+away|funeral|grief|grieving|bereave|miscarriage|stillborn)\b/i,
  /\b(diagnos(ed|is)|cancer|parkinson|dementia|alzheimer|terminal|chemo|hospice|stroke)\b/i,
  /\b(abus(e|ed|ive)|coercive|controll?ing|checks\s+my\s+phone|threaten(s|ed)?\s+me)\b/i,
  /\b(panic\s+attack|breakdown|can'?t\s+stop\s+crying|depress(ed|ion)|hopeless)\b/i,
  /\b(laid\s+off|lost\s+my\s+job)\b/i,
];

const MINOR: RegExp[] = [/\bI\s*(am|'m)\s*(1[0-7]|[5-9])\b(?!\s*(years?\s+(into|at|in)|k|lakh|%))/i, /\b(1[0-7]|[5-9])\s*(years?\s*old|yo)\b(?=.*\b(I|me|my)\b)/i];

export function detectMinor(text: string): boolean {
  return MINOR.some((re) => re.test(text));
}

/**
 * "No mercy" auto-downgrades to Measured on distress, grief, abuse, illness or a
 * minor (persona-specs.md, intensity modifiers). Sharp is left alone except for minors.
 */
export function effectiveIntensity(requested: Intensity, text: string): { intensity: Intensity; downgraded: boolean; reason: string | null } {
  const minor = detectMinor(text);
  if (minor && requested !== "measured") return { intensity: "measured", downgraded: true, reason: "minor_suspected" };
  if (requested === "nomercy" && DISTRESS.some((re) => re.test(text))) return { intensity: "measured", downgraded: true, reason: "distress" };
  return { intensity: requested, downgraded: false, reason: null };
}

/** Warm, persona-free reply (care mode). The UI adds local helplines. No pause marks. */
export function careReply(category: SafetyCategory = "crisis"): Reply {
  if (category === "abuse") {
    return {
      mode: "care",
      line: "What happened to you is not your fault, and you don't deserve to be hurt.",
      followup:
        "Your safety matters more than keeping the peace. If you are in danger right now, call your local emergency number.",
      matter: "Your safety first",
      read: "Being hit is never acceptable, whatever the reason given. You deserve support right now.",
      play: [
        "If you are in danger, call emergency services now, or go to a safe place.",
        "Contact a domestic violence helpline or a crisis line; they can help you make a safety plan.",
        "Tell one person you trust what is happening today, and keep your phone charged and close.",
      ],
      avoid: "",
      principle: "",
      intent: "crisis",
      stakes: "high",
      hours: 0.1,
    };
  }
  return {
    mode: "care",
    line: "What you're carrying sounds heavy, and I'm glad you said it out loud. You don't have to work this out alone tonight.",
    followup:
      "If you can, reach out to someone you trust right now, or talk to a trained person who is there for exactly this. If you're in danger, call your local emergency number now.",
    matter: "Checking in on you",
    read: "You deserve support right now, from a real person.",
    play: [
      "Call or message a crisis line now; it is free, confidential and there to listen.",
      "Reach one person you trust and tell them how you're feeling tonight.",
      "Put some distance between yourself and anything you could use to hurt yourself, and stay somewhere safe.",
    ],
    avoid: "",
    principle: "",
    intent: "crisis",
    stakes: "high",
    hours: 0.1,
  };
}
