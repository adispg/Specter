import type { SupabaseClient } from "@supabase/supabase-js";
import type { CasePatch, DataStore, ExportBundle, GuestThrottle, ProfilePatch } from "./store";
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
import type { PersonaId } from "@/lib/personas/config";

function check<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
}

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

function toProfile(row: Record<string, unknown>): Profile {
  const settings = { ...DEFAULT_SETTINGS, ...((row.settings as object) ?? {}) } as Profile["settings"];
  settings.voices = { ...(settings.voices ?? {}) };
  return {
    id: row.id as string,
    display_name: (row.display_name as string) ?? null,
    locale: (row.locale as string) ?? null,
    country: (row.country as string) ?? null,
    age_confirmed_at: (row.age_confirmed_at as string) ?? null,
    disclosure_ack_at: (row.disclosure_ack_at as string) ?? null,
    onboarded_at: (row.onboarded_at as string) ?? null,
    settings,
    plan: row.plan === "pro" ? "pro" : "free",
    created_at: row.created_at as string,
  };
}

const CASE_COLS = "id,user_id,persona,intensity,situation,title,intent,stakes,moment_at,debrief_status,debrief_note,last_activity_at,created_at";
const CONSULT_COLS =
  "id,case_id,user_id,persona,kind,user_input,spoken,reply,mode,intensity,model,prompt_version,latency_ms,tokens_in,tokens_out,cache_read_tokens,created_at";

/**
 * Postgres through the signed-in user's own Supabase session. Queries also filter
 * by user id, but Row Level Security is what enforces ownership.
 */
export class SupabaseStore implements DataStore {
  constructor(
    private readonly sb: SupabaseClient,
    readonly userId: string,
  ) {}

  async getProfile(): Promise<Profile> {
    const data = check(await this.sb.from("profiles").select("*").eq("id", this.userId).maybeSingle(), "load profile");
    if (data) return toProfile(data);
    const created = check(await this.sb.from("profiles").upsert({ id: this.userId }, { onConflict: "id" }).select("*").single(), "create profile");
    return toProfile(created);
  }

  async updateProfile(patch: ProfilePatch): Promise<Profile> {
    const current = await this.getProfile();
    const row: Record<string, unknown> = {};
    const now = new Date().toISOString();
    if (patch.display_name !== undefined) row.display_name = patch.display_name;
    if (patch.locale !== undefined) row.locale = patch.locale;
    if (patch.country !== undefined) row.country = patch.country;
    if (patch.settings)
      row.settings = { ...current.settings, ...patch.settings, voices: { ...current.settings.voices, ...(patch.settings.voices ?? {}) } };
    if (patch.ageConfirmed && !current.age_confirmed_at) row.age_confirmed_at = now;
    if (patch.disclosureAck && !current.disclosure_ack_at) row.disclosure_ack_at = now;
    if (patch.onboarded && !current.onboarded_at) row.onboarded_at = now;
    if (Object.keys(row).length === 0) return current;
    return toProfile(check(await this.sb.from("profiles").update(row).eq("id", this.userId).select("*").single(), "update profile") as Record<string, unknown>);
  }

  async createCase(input: Parameters<DataStore["createCase"]>[0]): Promise<CaseRow> {
    return check(
      await this.sb
        .from("cases")
        .insert({ user_id: this.userId, ...input, title: input.title ?? null, intent: input.intent ?? null, stakes: input.stakes ?? null })
        .select(CASE_COLS)
        .single(),
      "create case",
    ) as unknown as CaseRow;
  }

  async getCase(id: string): Promise<CaseRow | null> {
    if (!isUuid(id)) return null;
    return check(await this.sb.from("cases").select(CASE_COLS).eq("id", id).eq("user_id", this.userId).maybeSingle(), "load case") as unknown as CaseRow | null;
  }

  async updateCase(id: string, patch: CasePatch): Promise<void> {
    if (!isUuid(id)) return;
    check(await this.sb.from("cases").update(patch).eq("id", id).eq("user_id", this.userId), "update case");
  }

  async touchCase(id: string): Promise<void> {
    check(await this.sb.from("cases").update({ last_activity_at: new Date().toISOString() }).eq("id", id).eq("user_id", this.userId), "touch case");
  }

  async listCases(limit = 50): Promise<CaseSummary[]> {
    const cases = check(
      await this.sb.from("cases").select(CASE_COLS).eq("user_id", this.userId).is("archived_at", null).order("last_activity_at", { ascending: false }).limit(limit),
      "list cases",
    ) as unknown as CaseRow[];
    if (cases.length === 0) return [];
    const rows = check(
      await this.sb
        .from("consults")
        // Aliased. Without "line:" the JSON field does not come back under the
        // key this code reads, so latest_line was always null and every case in
        // the list lost its preview line.
        .select("case_id, persona, line:reply->>line, created_at")
        .in(
          "case_id",
          cases.map((c) => c.id),
        )
        .order("created_at", { ascending: true }),
      "list consults",
    ) as unknown as Array<{ case_id: string; persona: PersonaId; line: string }>;
    const byCase = new Map<string, Array<{ persona: PersonaId; line: string }>>();
    for (const r of rows) byCase.set(r.case_id, [...(byCase.get(r.case_id) ?? []), r]);
    return cases.map((c) => {
      const list = byCase.get(c.id) ?? [];
      const latest = list[list.length - 1];
      return {
        ...c,
        latest_line: latest?.line ?? null,
        latest_persona: latest?.persona ?? null,
        personas: [...new Set(list.map((x) => x.persona))],
        consult_count: list.length,
      };
    });
  }

  async countCases(): Promise<number> {
    const res = await this.sb.from("cases").select("id", { count: "exact", head: true }).eq("user_id", this.userId);
    if (res.error) throw new Error(`count cases: ${res.error.message}`);
    return res.count ?? 0;
  }

  async deleteCase(id: string): Promise<void> {
    if (!isUuid(id)) return;
    check(await this.sb.from("cases").delete().eq("id", id).eq("user_id", this.userId), "delete case");
  }

  async addConsult(caseId: string, consult: NewConsult): Promise<ConsultRow> {
    return check(
      await this.sb
        .from("consults")
        .insert({ ...consult, case_id: caseId, user_id: this.userId })
        .select(CONSULT_COLS)
        .single(),
      "add consult",
    ) as unknown as ConsultRow;
  }

  async createCaseWithConsult(
    input: Parameters<DataStore["createCase"]>[0],
    consult: Omit<NewConsult, "case_id">,
  ): Promise<{ caseRow: CaseRow; consult: ConsultRow } | null> {
    const res = await this.sb.rpc("create_case_with_consult", {
      p_case: { ...input, title: input.title ?? null, intent: input.intent ?? null, stakes: input.stakes ?? null },
      p_consult: consult,
    });
    if (res.error) {
      // Absent function: deploy can precede the migration, so fall back to the
      // two step path rather than failing the consult. Same tolerance as the
      // guest quota refund. Anything else is a real error and should surface.
      const missing = res.error.code === "PGRST202" || /could not find the function|does not exist/i.test(res.error.message);
      if (missing) return null;
      throw new Error(`create case with consult: ${res.error.message}`);
    }
    const data = res.data as { case: CaseRow; consult: ConsultRow } | null;
    if (!data?.case || !data?.consult) return null;
    return { caseRow: data.case, consult: data.consult };
  }

  async listConsults(caseId: string): Promise<ConsultRow[]> {
    if (!isUuid(caseId)) return [];
    return check(
      await this.sb.from("consults").select(CONSULT_COLS).eq("case_id", caseId).order("created_at", { ascending: true }),
      "list consults",
    ) as unknown as ConsultRow[];
  }

  async getConsult(id: string): Promise<ConsultRow | null> {
    if (!isUuid(id)) return null;
    return check(await this.sb.from("consults").select(CONSULT_COLS).eq("id", id).maybeSingle(), "load consult") as unknown as ConsultRow | null;
  }

  async saveLine(input: Omit<SavedLine, "id" | "user_id" | "created_at">): Promise<SavedLine> {
    if (input.consult_id) {
      const existing = check(
        await this.sb.from("saved_lines").select("*").eq("user_id", this.userId).eq("consult_id", input.consult_id).maybeSingle(),
        "check saved line",
      );
      if (existing) return existing as SavedLine;
    }
    return check(await this.sb.from("saved_lines").insert({ ...input, user_id: this.userId }).select("*").single(), "save line") as SavedLine;
  }

  async listSavedLines(): Promise<SavedLine[]> {
    return check(
      await this.sb.from("saved_lines").select("*").eq("user_id", this.userId).order("created_at", { ascending: false }),
      "list saved lines",
    ) as SavedLine[];
  }

  async deleteSavedLine(id: string): Promise<void> {
    if (!isUuid(id)) return;
    check(await this.sb.from("saved_lines").delete().eq("id", id).eq("user_id", this.userId), "delete saved line");
  }

  async deleteSavedLineForConsult(consultId: string): Promise<void> {
    if (!isUuid(consultId)) return;
    check(await this.sb.from("saved_lines").delete().eq("consult_id", consultId).eq("user_id", this.userId), "unsave line");
  }

  async setFeedback(f: Feedback): Promise<void> {
    check(
      await this.sb.from("feedback").upsert({ ...f, user_id: this.userId }, { onConflict: "user_id,consult_id" }),
      "save feedback",
    );
  }

  async getFeedback(consultIds: string[]): Promise<Feedback[]> {
    if (consultIds.length === 0) return [];
    return check(
      await this.sb.from("feedback").select("consult_id,rating,reason,note").eq("user_id", this.userId).in("consult_id", consultIds),
      "load feedback",
    ) as Feedback[];
  }

  async countUsage(kind: UsageKind, since: Date, opts: { billableOnly?: boolean } = {}): Promise<number> {
    let q = this.sb
      .from("usage_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", this.userId)
      .eq("kind", kind)
      .gte("created_at", since.toISOString());
    if (opts.billableOnly) q = q.eq("billable", true);
    const res = await q;
    if (res.error) throw new Error(`count usage: ${res.error.message}`);
    return res.count ?? 0;
  }

  async recordUsage(kind: UsageKind, meta: Record<string, unknown> = {}, billable = true): Promise<void> {
    check(await this.sb.from("usage_events").insert({ user_id: this.userId, kind, meta, billable }), "record usage");
  }

  async recordSafetyEvent(e: SafetyEvent): Promise<void> {
    check(await this.sb.from("safety_events").insert({ ...e, user_id: this.userId }), "record safety event");
  }

  async getAudio(hash: string): Promise<AudioCacheEntry | null> {
    const row = check(
      await this.sb.from("audio_cache").select("hash,case_id,mime,audio_b64,timeline,chars").eq("user_id", this.userId).eq("hash", hash).maybeSingle(),
      "load audio",
    ) as AudioCacheEntry | null;
    if (row) void this.sb.from("audio_cache").update({ last_used_at: new Date().toISOString() }).eq("user_id", this.userId).eq("hash", hash);
    return row;
  }

  async putAudio(entry: AudioCacheEntry): Promise<void> {
    check(await this.sb.from("audio_cache").upsert({ ...entry, user_id: this.userId }, { onConflict: "user_id,hash" }), "store audio");
  }

  async exportAll(): Promise<ExportBundle> {
    const cases = check(await this.sb.from("cases").select(CASE_COLS).eq("user_id", this.userId).order("created_at"), "export cases") as unknown as CaseRow[];
    const consults = check(
      await this.sb.from("consults").select(CONSULT_COLS).eq("user_id", this.userId).order("created_at"),
      "export consults",
    ) as unknown as ConsultRow[];
    const feedback = check(await this.sb.from("feedback").select("consult_id,rating,reason,note").eq("user_id", this.userId), "export feedback") as Feedback[];
    return {
      exported_at: new Date().toISOString(),
      profile: await this.getProfile(),
      cases: cases.map((c) => ({ ...c, consults: consults.filter((x) => x.case_id === c.id) })),
      saved_lines: await this.listSavedLines(),
      feedback,
    };
  }

  async deleteAccount(): Promise<void> {
    check(await this.sb.rpc("delete_my_account"), "delete account");
    await this.sb.auth.signOut();
  }

  /**
   * Fire-and-forget retention sweep. Deletes stale rows from audio_cache,
   * usage_events, and guest_usage via the purge_stale_data() DB function.
   * Never throws: any failure is logged and silently swallowed so a cleanup
   * hiccup never affects the caller.
   */
  purgeStaleData(): void {
    void this.sb.rpc("purge_stale_data").then((res) => {
      if (res.error) console.warn("[retention] purge_stale_data failed:", res.error.message);
    });
  }
}

export class SupabaseGuestThrottle implements GuestThrottle {
  constructor(private readonly sb: SupabaseClient) {}
  async consume(keyHash: string, limit: number, windowHours: number): Promise<boolean> {
    const res = await this.sb.rpc("consume_guest_quota", { p_key: keyHash, p_limit: limit, p_window_hours: windowHours });
    if (res.error) throw new Error(`guest quota: ${res.error.message}`);
    return res.data === true;
  }

  async release(keyHash: string): Promise<void> {
    // Swallowed deliberately: this runs on a path that is already failing, and
    // the caller is about to surface the real error. Tolerates the function not
    // existing yet so the refund can ship ahead of the migration.
    const res = await this.sb.rpc("release_guest_quota", { p_key: keyHash });
    if (res.error) console.warn(`[guest quota] refund failed: ${res.error.message}`);
  }
}
