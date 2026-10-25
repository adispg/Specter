import { INTENSITY_PROMPTS, PERSONAS, type Intensity, type PersonaId } from "./config";
import { COMMON_RULES, OUTPUT_CONTRACT, intentHints } from "./rules";
import type { ConsultRow } from "@/lib/data/types";
import type { ConsultRequest } from "@/lib/consult/schema";

export type ChatTurn = { role: "user" | "assistant"; content: string };

/** System prompt split for prompt caching: a static block per persona, then a small dynamic block. */
export type SystemBlocks = { cached: string; dynamic: string };

/**
 * Assembly order from persona-specs.md section 5: persona bible, shared rules
 * (with safety overrides and the output contract), intent hints, intensity,
 * locale, one style anchor. Items 1 to 3 are static per persona and cached.
 */
export function buildSystemPrompt(persona: PersonaId, intensity: Intensity, country?: string | null): SystemBlocks {
  const p = PERSONAS[persona];
  const cached = `${p.bible}\n\n${COMMON_RULES}\n\n${intentHints()}\n\n${OUTPUT_CONTRACT}`;
  const anchor = JSON.stringify(p.example.reply);
  const dynamic = [
    `INTENSITY\n${INTENSITY_PROMPTS[intensity]}`,
    country ? `LOCALE\nThe user is probably in ${country.toUpperCase()}. Use local currency and norms where relevant.` : null,
    `STYLE ANCHOR (shows voice and shape only; never reuse its words)\nSituation: ${p.example.situation}\nReply: ${anchor}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  return { cached, dynamic };
}

export function systemText(s: SystemBlocks): string {
  return `${s.cached}\n\n${s.dynamic}`;
}

const MAX_SITUATION = 4000;
const MAX_FOLLOWUP = 1500;

export function situationTurn(situation: string): string {
  return `THE USER'S SITUATION\n${situation.slice(0, MAX_SITUATION)}`;
}

export function followupTurn(text: string): string {
  return `Follow-up from the user: ${text.slice(0, MAX_FOLLOWUP)}\nIf this is push back, re-examine: adjust and say what changed, or hold your position with one reason. Same JSON shape, only the JSON.`;
}

export function anotherTurn(intensity: Intensity): string {
  return `Same situation. Give me a completely different line and followup from a new angle (share less than half the words of your previous line), adjusting the read and play if needed. Intensity: ${INTENSITY_PROMPTS[intensity]} Same JSON shape, only the JSON.`;
}

export const SWITCH_NOTE =
  "The user wants your take on this situation, in your own voice and from your own angle. Only the JSON.";

function contextNote(facts: string[]): string {
  return `Context the user added later (to someone else): ${facts.map((f) => `"${f.slice(0, 400)}"`).join("; ")}`;
}

/**
 * Rebuild the thread a persona sees for a case (PRD 6.5, 6.6).
 * - The original situation always opens the thread.
 * - This persona's own consults appear as user turn + assistant JSON.
 * - Follow-ups the user sent to other personas reach this persona only as a short
 *   neutral note of facts; other personas' advice is never shown (no anchoring).
 * - Roles alternate; consecutive user turns are merged.
 * - Long threads keep the opener plus the last 8 turns.
 */
export function buildTurns(persona: PersonaId, history: ConsultRow[], request: ConsultRequest, maxTurns = 9): ChatTurn[] {
  const turns: ChatTurn[] = [];
  const push = (role: ChatTurn["role"], content: string) => {
    const last = turns[turns.length - 1];
    if (last && last.role === role) {
      if (role === "user") last.content = `${last.content}\n\n${content}`;
      else last.content = content;
    } else turns.push({ role, content });
  };

  const initial = history.find((c) => c.kind === "initial");
  const situation = request.action === "new" ? request.situation : (initial?.user_input ?? "");
  push("user", situationTurn(situation));

  let pending: string[] = [];
  const withPending = (content: string) => {
    if (pending.length === 0) return content;
    const note = contextNote(pending);
    pending = [];
    return `${note}\n\n${content}`;
  };

  let spoken = false;
  for (const c of history) {
    if (c.persona !== persona) {
      if (c.kind === "followup" && c.user_input) pending.push(c.user_input);
      continue;
    }
    switch (c.kind) {
      case "initial":
        if (pending.length) push("user", withPending("Your take. Only the JSON."));
        break;
      case "followup":
        push("user", withPending(followupTurn(c.user_input ?? "")));
        break;
      case "another":
        push("user", withPending(anotherTurn(c.intensity)));
        break;
      case "switch":
        push("user", withPending(SWITCH_NOTE));
        break;
    }
    if (turns[turns.length - 1]?.role === "assistant") push("user", "Go on. Only the JSON.");
    push("assistant", JSON.stringify(c.reply));
    spoken = true;
  }

  switch (request.action) {
    case "new":
      break;
    case "followup":
      push("user", withPending(followupTurn(request.text)));
      break;
    case "another":
      push("user", withPending(spoken ? anotherTurn(request.intensity) : SWITCH_NOTE));
      break;
    case "switch":
      push("user", withPending(spoken ? anotherTurn(request.intensity) : SWITCH_NOTE));
      break;
  }
  if (turns[turns.length - 1]?.role !== "user") push("user", "Your take. Only the JSON.");

  if (turns.length > maxTurns) {
    const head = turns[0]!;
    let tail = turns.slice(-(maxTurns - 1));
    if (tail[0]?.role === "user") tail = tail.slice(1);
    return [head, ...tail];
  }
  return turns;
}
