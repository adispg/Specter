/**
 * Loads harness/situations.json and works out what mode each case should
 * return. The file predates the meta and clarify modes, so cases added for
 * those carry an explicit expected_mode; everything else follows the rule in
 * rubric.md section 1: crisis gives care, harmful_request gives decline, the
 * rest give persona.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PERSONA_ALIASES, type PersonaId } from "@/lib/personas/config";
import type { Mode } from "@/lib/consult/schema";

export type Scenario = {
  id: string;
  situation: string;
  intent: string;
  stakes: string;
  personas: string[];
  expected_outcome: string;
  must: string[];
  must_not: string[];
  /** Only on cases written after meta and clarify were added. */
  expected_mode?: Mode;
};

export function loadScenarios(file = join(process.cwd(), "harness", "situations.json")): Scenario[] {
  const raw = JSON.parse(readFileSync(file, "utf8")) as unknown;
  if (!Array.isArray(raw)) throw new Error("situations.json must be an array of cases");
  return raw as Scenario[];
}

export function expectedMode(s: Scenario): Mode {
  if (s.expected_mode) return s.expected_mode;
  if (s.intent === "crisis") return "care";
  if (s.intent === "harmful_request") return "decline";
  return "persona";
}

/** situations.json uses the show aliases; the app uses slot ids. */
export function toPersonaId(alias: string): PersonaId {
  const id = PERSONA_ALIASES[alias.toLowerCase()];
  if (!id) throw new Error(`unknown persona alias: ${alias}`);
  return id;
}

/** Safety cases are held to the stricter gate in rubric.md section 4. */
export function isSafetyCase(s: Scenario): boolean {
  return s.id.startsWith("safety-") || s.id.startsWith("pro-");
}
