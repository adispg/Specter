import { randomUUID } from "node:crypto";
import type { DataStore, ExportBundle, GuestThrottle, ProfilePatch, CasePatch } from "./store";
import {
  DEFAULT_SETTINGS,
  type AudioCacheEntry,
  type CaseRow,
  type CaseSummary,
  type ConsultRow,
  type Feedback,
  type NewConsult,
  type Profile,
  type SafetyEvent,
  type SavedLine,
  type UsageKind,
} from "./types";

/**
 * In-process store for mock mode. Lives on globalThis so it survives hot reloads
 * in `next dev` and is shared by every route in one `next start` process. Data is
 * lost on restart, which is what tests want.
 */
type Db = {
  profiles: Map<string, Profile>;
  cases: Map<string, CaseRow>;
  consults: ConsultRow[];
  saved: SavedLine[];
  feedback: Array<Feedback & { user_id: string }>;
  usage: Array<{ user_id: string; kind: UsageKind; billable: boolean; created_at: number }>;
  safety: Array<SafetyEvent & { user_id: string; created_at: number }>;
  audio: Map<string, AudioCacheEntry & { user_id: string }>;
  guest: Array<{ key: string; created_at: number }>;
};

const g = globalThis as unknown as { __specterMemoryDb?: Db };
function db(): Db {
  g.__specterMemoryDb ??= {
    profiles: new Map(),
    cases: new Map(),
    consults: [],
    saved: [],
    feedback: [],
    usage: [],
    safety: [],
    audio: new Map(),
    guest: [],
  };
  return g.__specterMemoryDb;
}

export function resetMemoryDb() {
  g.__specterMemoryDb = undefined;
}

let lastTs = 0;
function nowIso(): string {
  const t = Math.max(Date.now(), lastTs + 1);
  lastTs = t;
  return new Date(t).toISOString();
}

const clone = <T>(v: T): T => structuredClone(v);

/** Move every row from one user id to another (simulates linking a guest to a real account). */
export function reassignMemoryUser(fromId: string, toId: string) {
  if (fromId === toId) return;
  const d = db();
  for (const c of d.cases.values()) if (c.user_id === fromId) c.user_id = toId;
  for (const c of d.consults) if (c.user_id === fromId) c.user_id = toId;
  for (const s of d.saved) if (s.user_id === fromId) s.user_id = toId;
  for (const f of d.feedback) if (f.user_id === fromId) f.user_id = toId;
  for (const u of d.usage) if (u.user_id === fromId) u.user_id = toId;
  const p = d.profiles.get(fromId);
  if (p && !d.profiles.has(toId)) d.profiles.set(toId, { ...p, id: toId });
  d.profiles.delete(fromId);
}

export class MemoryStore implements DataStore {
  constructor(readonly userId: string) {}

  async getProfile(): Promise<Profile> {
    const d = db();
    let p = d.profiles.get(this.userId);
    if (!p) {
      p = {
        id: this.userId,
        display_name: null,
        locale: null,
        country: null,
        age_confirmed_at: null,
        disclosure_ack_at: null,
        onboarded_at: null,
        settings: clone(DEFAULT_SETTINGS),
        plan: "free",
        created_at: nowIso(),
      };
      d.profiles.set(this.userId, p);
    }
    return clone(p);
  }

  async updateProfile(patch: ProfilePatch): Promise<Profile> {
    const p = await this.getProfile();
    if (patch.display_name !== undefined) p.display_name = patch.display_name;
    if (patch.locale !== undefined) p.locale = patch.locale;
    if (patch.country !== undefined) p.country = patch.country;
    if (patch.settings) p.settings = { ...p.settings, ...patch.settings, voices: { ...p.settings.voices, ...(patch.settings.voices ?? {}) } };
    if (patch.ageConfirmed) p.age_confirmed_at ??= nowIso();
    if (patch.disclosureAck) p.disclosure_ack_at ??= nowIso();
    if (patch.onboarded) p.onboarded_at ??= nowIso();
    db().profiles.set(this.userId, p);
    return clone(p);
  }

  async createCase(input: Parameters<DataStore["createCase"]>[0]): Promise<CaseRow> {
    const ts = nowIso();
    const row: CaseRow = {
      id: randomUUID(),
      user_id: this.userId,
      persona: input.persona,
      intensity: input.intensity,
      situation: input.situation,
      title: input.title ?? null,
      intent: input.intent ?? null,
      stakes: input.stakes ?? null,
      moment_at: null,
      debrief_status: "none",
      debrief_note: null,
      last_activity_at: ts,
      created_at: ts,
    };
    db().cases.set(row.id, row);
    return clone(row);
  }

  private own(id: string): CaseRow | null {
    const c = db().cases.get(id);
    return c && c.user_id === this.userId ? c : null;
  }

  async getCase(id: string): Promise<CaseRow | null> {
    const c = this.own(id);
    return c ? clone(c) : null;
  }

  async updateCase(id: string, patch: CasePatch): Promise<void> {
    const c = this.own(id);
    if (c) Object.assign(c, patch);
  }

  async touchCase(id: string): Promise<void> {
    const c = this.own(id);
    if (c) c.last_activity_at = nowIso();
  }

  async listCases(limit = 50): Promise<CaseSummary[]> {
    const d = db();
    return [...d.cases.values()]
      .filter((c) => c.user_id === this.userId)
      .sort((a, b) => b.last_activity_at.localeCompare(a.last_activity_at))
      .slice(0, limit)
      .map((c) => {
        const consults = d.consults.filter((m) => m.case_id === c.id);
        const latest = consults[consults.length - 1];
        const personas = [...new Set(consults.map((x) => x.persona))];
        return {
          ...clone(c),
          latest_line: latest?.reply.line ?? null,
          latest_persona: latest?.persona ?? null,
          personas,
          consult_count: consults.length,
        };
      });
  }

  async countCases(): Promise<number> {
    return [...db().cases.values()].filter((c) => c.user_id === this.userId).length;
  }

  async deleteCase(id: string): Promise<void> {
    const d = db();
    if (!this.own(id)) return;
    const consultIds = new Set(d.consults.filter((c) => c.case_id === id).map((c) => c.id));
    d.cases.delete(id);
    d.consults = d.consults.filter((m) => m.case_id !== id);
    d.saved = d.saved.filter((s) => !(s.consult_id && consultIds.has(s.consult_id)));
    d.feedback = d.feedback.filter((f) => !consultIds.has(f.consult_id));
    for (const [k, a] of d.audio) if (a.case_id === id) d.audio.delete(k);
  }

  async addConsult(caseId: string, consult: NewConsult): Promise<ConsultRow> {
    if (!this.own(caseId)) throw new Error("case not found");
    const row: ConsultRow = { ...clone(consult), case_id: caseId, id: randomUUID(), user_id: this.userId, created_at: nowIso() };
    db().consults.push(row);
    return clone(row);
  }

  async listConsults(caseId: string): Promise<ConsultRow[]> {
    if (!this.own(caseId)) return [];
    return clone(db().consults.filter((m) => m.case_id === caseId));
  }

  async getConsult(id: string): Promise<ConsultRow | null> {
    const m = db().consults.find((x) => x.id === id);
    return m && m.user_id === this.userId ? clone(m) : null;
  }

  async saveLine(input: Omit<SavedLine, "id" | "user_id" | "created_at">): Promise<SavedLine> {
    const d = db();
    const existing = input.consult_id ? d.saved.find((s) => s.user_id === this.userId && s.consult_id === input.consult_id) : undefined;
    if (existing) return clone(existing);
    const row: SavedLine = { ...input, id: randomUUID(), user_id: this.userId, created_at: nowIso() };
    d.saved.push(row);
    return clone(row);
  }

  async listSavedLines(): Promise<SavedLine[]> {
    return clone(
      db()
        .saved.filter((s) => s.user_id === this.userId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    );
  }

  async deleteSavedLine(id: string): Promise<void> {
    const d = db();
    d.saved = d.saved.filter((s) => !(s.id === id && s.user_id === this.userId));
  }

  async deleteSavedLineForConsult(consultId: string): Promise<void> {
    const d = db();
    d.saved = d.saved.filter((s) => !(s.consult_id === consultId && s.user_id === this.userId));
  }

  async setFeedback(f: Feedback): Promise<void> {
    const d = db();
    d.feedback = d.feedback.filter((x) => !(x.user_id === this.userId && x.consult_id === f.consult_id));
    d.feedback.push({ ...f, user_id: this.userId });
  }

  async getFeedback(consultIds: string[]): Promise<Feedback[]> {
    const ids = new Set(consultIds);
    return db()
      .feedback.filter((f) => f.user_id === this.userId && ids.has(f.consult_id))
      .map(({ user_id: _u, ...f }) => f);
  }

  async countUsage(kind: UsageKind, since: Date, opts: { billableOnly?: boolean } = {}): Promise<number> {
    const t = since.getTime();
    return db().usage.filter((u) => u.user_id === this.userId && u.kind === kind && u.created_at >= t && (!opts.billableOnly || u.billable)).length;
  }

  async recordUsage(kind: UsageKind, _meta?: Record<string, unknown>, billable = true): Promise<void> {
    db().usage.push({ user_id: this.userId, kind, billable, created_at: Date.now() });
  }

  async recordSafetyEvent(e: SafetyEvent): Promise<void> {
    db().safety.push({ ...e, user_id: this.userId, created_at: Date.now() });
  }

  async getAudio(hash: string): Promise<AudioCacheEntry | null> {
    const a = db().audio.get(`${this.userId}:${hash}`);
    if (!a) return null;
    const { user_id: _u, ...rest } = a;
    return rest;
  }

  async putAudio(entry: AudioCacheEntry): Promise<void> {
    db().audio.set(`${this.userId}:${entry.hash}`, { ...entry, user_id: this.userId });
  }

  async exportAll(): Promise<ExportBundle> {
    const cases = (await this.listCases(10_000)).map(({ latest_line: _l, latest_persona: _p, personas: _ps, consult_count: _c, ...c }) => c);
    const withConsults = await Promise.all(cases.map(async (c) => ({ ...c, consults: await this.listConsults(c.id) })));
    const consultIds = withConsults.flatMap((c) => c.consults.map((x) => x.id));
    return {
      exported_at: new Date().toISOString(),
      profile: await this.getProfile(),
      cases: withConsults,
      saved_lines: await this.listSavedLines(),
      feedback: await this.getFeedback(consultIds),
    };
  }

  async deleteAccount(): Promise<void> {
    const d = db();
    const caseIds = new Set([...d.cases.values()].filter((c) => c.user_id === this.userId).map((c) => c.id));
    for (const id of caseIds) d.cases.delete(id);
    d.consults = d.consults.filter((m) => m.user_id !== this.userId);
    d.saved = d.saved.filter((s) => s.user_id !== this.userId);
    d.feedback = d.feedback.filter((f) => f.user_id !== this.userId);
    d.usage = d.usage.filter((u) => u.user_id !== this.userId);
    for (const s of d.safety) if (s.user_id === this.userId) s.user_id = "";
    for (const [k, a] of d.audio) if (a.user_id === this.userId) d.audio.delete(k);
    d.profiles.delete(this.userId);
  }
}

export class MemoryGuestThrottle implements GuestThrottle {
  async consume(keyHash: string, limit: number, windowHours: number): Promise<boolean> {
    const d = db();
    const since = Date.now() - windowHours * 3600_000;
    const used = d.guest.filter((x) => x.key === keyHash && x.created_at >= since).length;
    if (used >= limit) return false;
    d.guest.push({ key: keyHash, created_at: Date.now() });
    return true;
  }

  async release(keyHash: string): Promise<void> {
    const d = db();
    // Newest entry for this key only, mirroring release_guest_quota.
    for (let i = d.guest.length - 1; i >= 0; i--) {
      if (d.guest[i]!.key === keyHash) {
        d.guest.splice(i, 1);
        return;
      }
    }
  }
}
