import type {
  AudioCacheEntry,
  CaseRow,
  CaseSummary,
  ConsultRow,
  DebriefStatus,
  Feedback,
  NewConsult,
  Profile,
  SafetyEvent,
  SavedLine,
  UsageKind,
  UserSettings,
} from "./types";

export type ProfilePatch = {
  display_name?: string | null;
  locale?: string | null;
  country?: string | null;
  settings?: Partial<UserSettings>;
  ageConfirmed?: boolean;
  disclosureAck?: boolean;
  onboarded?: boolean;
};

export type CasePatch = {
  title?: string | null;
  intent?: string | null;
  stakes?: string | null;
  moment_at?: string | null;
  debrief_status?: DebriefStatus;
  debrief_note?: string | null;
};

export type ExportBundle = {
  exported_at: string;
  profile: Profile | null;
  cases: Array<CaseRow & { consults: ConsultRow[] }>;
  saved_lines: SavedLine[];
  feedback: Feedback[];
};

/**
 * Data access bound to one signed-in (or guest) user. Two implementations:
 * - SupabaseStore: Postgres through the user's own session, so Row Level Security applies.
 * - MemoryStore: in-process, for MOCK_AI test-user mode (no keys, no database).
 */
export interface DataStore {
  readonly userId: string;

  getProfile(): Promise<Profile>;
  updateProfile(patch: ProfilePatch): Promise<Profile>;

  createCase(input: { persona: CaseRow["persona"]; intensity: CaseRow["intensity"]; situation: string; title?: string | null; intent?: string | null; stakes?: string | null }): Promise<CaseRow>;
  getCase(id: string): Promise<CaseRow | null>;
  updateCase(id: string, patch: CasePatch): Promise<void>;
  touchCase(id: string): Promise<void>;
  listCases(limit?: number): Promise<CaseSummary[]>;
  countCases(): Promise<number>;
  deleteCase(id: string): Promise<void>;

  addConsult(caseId: string, consult: NewConsult): Promise<ConsultRow>;
  /**
   * Create a case and its first consult together, so a failure cannot leave a
   * case with no consult showing as a dead row in the user's list. Returns null
   * when the backing database function is not present, and the caller falls
   * back to the two step path.
   */
  createCaseWithConsult(
    input: Parameters<DataStore["createCase"]>[0],
    consult: Omit<NewConsult, "case_id">,
  ): Promise<{ caseRow: CaseRow; consult: ConsultRow } | null>;
  listConsults(caseId: string): Promise<ConsultRow[]>;
  getConsult(id: string): Promise<ConsultRow | null>;

  saveLine(input: Omit<SavedLine, "id" | "user_id" | "created_at">): Promise<SavedLine>;
  listSavedLines(): Promise<SavedLine[]>;
  deleteSavedLine(id: string): Promise<void>;
  deleteSavedLineForConsult(consultId: string): Promise<void>;

  setFeedback(f: Feedback): Promise<void>;
  getFeedback(consultIds: string[]): Promise<Feedback[]>;

  countUsage(kind: UsageKind, since: Date, opts?: { billableOnly?: boolean }): Promise<number>;
  recordUsage(kind: UsageKind, meta?: Record<string, unknown>, billable?: boolean): Promise<void>;

  recordSafetyEvent(e: SafetyEvent): Promise<void>;

  getAudio(hash: string): Promise<AudioCacheEntry | null>;
  putAudio(entry: AudioCacheEntry): Promise<void>;

  exportAll(): Promise<ExportBundle>;
  /** Permanently delete the account and every row that belongs to it. */
  deleteAccount(): Promise<void>;
  /**
   * Fire-and-forget retention sweep. Must never throw; failures are swallowed
   * by the implementation. No-op on non-persistent stores.
   */
  purgeStaleData(): void;
}

/** Device/IP throttle for guest consults; not bound to a user (guests are cheap to recreate). */
export interface GuestThrottle {
  /** Atomically consume one guest consult for this key if under the limit in the window. */
  consume(keyHash: string, limit: number, windowHours: number): Promise<boolean>;
  /**
   * Give one consumed consult back. Consuming happens before the model is
   * called, so that it stays atomic against concurrent requests; without a
   * refund a provider outage permanently spends a first-time guest's only
   * attempt. Best effort: a failed refund must never fail the request.
   */
  release(keyHash: string): Promise<void>;
}
