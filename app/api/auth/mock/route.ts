import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { authMode, getSession, isValidEmail, mockUserId, MOCK_USER_COOKIE, SEEN_COOKIE } from "@/lib/auth";
import { jsonError, readJson } from "@/lib/api";
import { reassignMemoryUser } from "@/lib/data/memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ email: z.string().trim().toLowerCase() });

/**
 * POST /api/auth/mock { email }: test-user sign in for MOCK_AI mode only. If the
 * browser holds a guest session, its cases move to the account (as Supabase
 * identity linking does in production).
 */
export async function POST(req: Request) {
  if (authMode() !== "mock") return jsonError("not_found", "Not found.", 404);
  const parsed = Body.safeParse(await readJson(req).catch(() => ({})));
  if (!parsed.success || !isValidEmail(parsed.data.email)) return jsonError("bad_request", "That doesn't look like an email.", 400);
  const email = parsed.data.email;
  const current = await getSession();
  if (current?.user.isGuest) reassignMemoryUser(current.user.id, mockUserId(email));
  const jar = await cookies();
  jar.set(MOCK_USER_COOKIE, email, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  jar.set(SEEN_COOKIE, "1", { sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  return NextResponse.json({ ok: true, linkedGuest: Boolean(current?.user.isGuest) });
}
