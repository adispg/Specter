import type { Intensity, PersonaId } from "@/lib/personas/config";
import type { ConsultAction, Mode, Reply } from "@/lib/consult/schema";
import type { SafetyCategory } from "@/lib/consult/safety";

export type UserSettings = {
  speak: boolean;
  /** 0.8 to 1.2 */
  pace: number;
  intensity: Intensity;
  persona: PersonaId;
  /** Also read the three moves aloud after the line and follow-up. */
  readPlay: boolean;
  /** Chosen ElevenLabs stock voice per persona (from config voice.options). */
  voices: Partial<Record<PersonaId, string>>;
};

export const DEFAULT_SETTINGS: UserSettings = {
  speak: true,
  pace: 1,
  intensity: "sharp",
  persona: "closer",
  readPlay: false,
  voices: {},
};

export type Plan = "free" | "pro";

export type Profile = {
  id: string;
  display_name: string | null;
  locale: string | null;
  country: string | null;
  age_confirmed_at: string | null;
  disclosure_ack_at: string | null;
  onboarded_at: string | null;
  settings: UserSettings;
  plan: Plan;
  created_at: string;
};

export type DebriefStatus = "none" | "used" | "partly" | "not_used";

export type CaseRow = {
  id: string;
  user_id: string;
  /** Persona that opened the case (the case itself is persona neutral). */
  persona: PersonaId;
  intensity: Intensity;
  situation: string;
  title: string | null;
  intent: string | null;
  stakes: string | null;
  moment_at: string | null;
  debrief_status: DebriefStatus;
  debrief_note: string | null;
  last_activity_at: string;
  created_at: string;
};

/** "initial" is the PRD name for the first consult on a case. */
export type ConsultKind = "initial" | "followup" | "another" | "switch";

export function kindForAction(a: ConsultAction): ConsultKind {
  return a === "new" ? "initial" : a;
}

export type ConsultRow = {
  id: string;
  case_id: string;
  user_id: string;
  persona: PersonaId;
  kind: ConsultKind;
  user_input: string | null;
  spoken: boolean;
  reply: Reply;
  mode: Mode;
  intensity: Intensity;
  model: string;
  prompt_version: string;
  latency_ms: number | null;
  tokens_in: number | null;
  tokens_out: number | null;
  cache_read_tokens: number | null;
  created_at: string;
};

export type NewConsult = Omit<ConsultRow, "id" | "user_id" | "created_at">;

export type SavedLine = {
  id: string;
  user_id: string;
  case_id: string | null;
  consult_id: string | null;
  persona: PersonaId;
  line_marked: string;
  line_text: string;
  followup_text: string | null;
  matter: string | null;
  created_at: string;
};

export type Feedback = {
  consult_id: string;
  rating: "up" | "down";
  reason: string | null;
  note: string | null;
};

export type UsageKind = "consult" | "tts" | "stt";

export type CaseSummary = CaseRow & {
  latest_line: string | null;
  latest_persona: PersonaId | null;
  personas: PersonaId[];
  consult_count: number;
};

export type SafetyEvent = { category: SafetyCategory; action: "care_mode" | "decline"; locale: string | null; consult_id: string | null };

export type AudioCacheEntry = { hash: string; case_id: string | null; mime: string; audio_b64: string; timeline: unknown; chars: number };
