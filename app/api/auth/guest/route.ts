import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { authMode, getSession, MOCK_USER_COOKIE, newGuestIdentity, requestCountry, SEEN_COOKIE } from "@/lib/auth";
import { errorResponse, jsonError, readJson } from "@/lib/api";
import { MemoryStore } from "@/lib/data/memory";
import { mockUserId } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupabaseStore } from "@/lib/data/supabase";
import { PersonaIdSchema } from "@/lib/consult/schema";
import { BRAND } from "@/lib/personas/config";
import type { DataStore } from "@/lib/data/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ ageConfirmed: z.literal(true), disclosureAck: z.literal(true), persona: PersonaIdSchema.optional() });

const YEAR = 60 * 60 * 24 * 365;

/**
 * POST /api/auth/guest: finish onboarding (18+ confirmed, AI disclosure acknowledged)
 * and start a guest session if there is none: Supabase anonymous sign-in, or a mock
 * guest identity in MOCK_AI mode. Existing sessions just record the acknowledgements.
 */
export async function POST(req: Request) {
  try {
    const parsed = Body.safeParse(await readJson(req));
    if (!parsed.success) return jsonError("bad_request", `Confirm you're 18 or older and that you understand ${BRAND.appName} is an AI.`, 400);
    const jar = await cookies();
    let store: DataStore;
    const existing = await getSession();
    if (existing) {
      store = existing.store;
    } else if (authMode() === "mock") {
      const identity = newGuestIdentity();
      jar.set(MOCK_USER_COOKIE, identity, { httpOnly: true, sameSite: "lax", path: "/", maxAge: YEAR });
      store = new MemoryStore(mockUserId(identity));
    } else if (authMode() === "supabase") {
      const sb = await createSupabaseServerClient();
      const { data, error } = await sb.auth.signInAnonymously();
      if (error || !data.user) return jsonError("guest_unavailable", "Guest mode is unavailable. Sign in to continue.", 503);
      store = new SupabaseStore(sb, data.user.id);
    } else {
      return jsonError("not_configured", "Sign in is not configured on this server.", 503);
    }
    await store.updateProfile({
      ageConfirmed: true,
      disclosureAck: true,
      onboarded: true,
      country: await requestCountry(),
      ...(parsed.data.persona ? { settings: { persona: parsed.data.persona } } : {}),
    });
    // Set seen cookie on the response directly so it is guaranteed to reach
    // the browser even if the cookies() jar has already been flushed.
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SEEN_COOKIE, "1", { sameSite: "lax", path: "/", maxAge: YEAR });
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}
