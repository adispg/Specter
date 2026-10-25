import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

/**
 * GET /auth/callback: completes magic link, Google OAuth and identity linking
 * (PKCE code exchange), then redirects. Expired or invalid links land on sign in
 * with a clear retry message.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = safeNext(url.searchParams.get("next"));
  const origin = url.origin;
  if (url.searchParams.get("error") || url.searchParams.get("error_description")) {
    return NextResponse.redirect(`${origin}/sign-in?error=expired`);
  }
  const code = url.searchParams.get("code");
  if (!code || !env.supabaseConfigured()) return NextResponse.redirect(`${origin}/sign-in?error=expired`);
  const sb = await createSupabaseServerClient();
  const { error } = await sb.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/sign-in?error=expired`);
  const res = NextResponse.redirect(`${origin}${next}`);
  res.cookies.set("specter_seen", "1", { sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  return res;
}
