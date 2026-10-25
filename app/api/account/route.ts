import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { MOCK_USER_COOKIE } from "@/lib/auth";
import { withSession } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** DELETE /api/account: permanently delete the account and all of its data, then sign out. */
export const DELETE = withSession(async (session) => {
  await session.store.deleteAccount();
  if (session.mode === "mock") (await cookies()).delete(MOCK_USER_COOKIE);
  return NextResponse.json({ ok: true });
});
