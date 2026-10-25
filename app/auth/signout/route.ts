import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { authMode, MOCK_USER_COOKIE } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /auth/signout: end the session and go to sign in. */
export async function POST(req: Request) {
  if (authMode() === "mock") (await cookies()).delete(MOCK_USER_COOKIE);
  else if (authMode() === "supabase") await (await createSupabaseServerClient()).auth.signOut();
  return NextResponse.redirect(new URL("/sign-in", req.url), { status: 303 });
}
