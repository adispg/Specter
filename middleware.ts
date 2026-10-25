import { NextResponse, type NextRequest } from "next/server";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

/**
 * Protects app routes and keeps the Supabase session fresh.
 * - Public: welcome (onboarding), sign in, auth callback, legal pages, offline page, static assets.
 * - API routes are not redirected; their handlers answer 401 JSON.
 * - Signed out on a protected page: first launch goes to /welcome, returning users to /sign-in.
 * - Sets a random device id cookie used (hashed) to throttle guest consults.
 */
export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|brand/|sw.js|manifest.webmanifest|robots.txt).*)"],
};

const PUBLIC = [/^\/welcome/, /^\/sign-in/, /^\/auth\//, /^\/offline/, /^\/privacy/, /^\/terms/, /^\/safety/, /^\/api\//];

const truthy = (v: string | undefined) => v === "1" || v?.toLowerCase() === "true";

function mockAuth(): boolean {
  if (process.env.VERCEL_ENV === "production" || !truthy(process.env.MOCK_AI)) return false;
  return truthy(process.env.MOCK_AUTH) || !(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isPublic = PUBLIC.some((re) => re.test(path));

  let res: NextResponse;
  let signedIn = false;
  if (mockAuth()) {
    res = NextResponse.next();
    signedIn = Boolean(req.cookies.get("specter_test_user")?.value);
  } else if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    try {
      const s = await updateSupabaseSession(req);
      res = s.response();
      signedIn = Boolean(s.user);
    } catch {
      res = NextResponse.next();
    }
  } else {
    res = NextResponse.next();
  }

  if (!isPublic && !signedIn) {
    const seen = req.cookies.get("specter_seen")?.value === "1";
    const url = req.nextUrl.clone();
    url.pathname = seen ? "/sign-in" : "/welcome";
    url.search = seen && path !== "/" ? `?next=${encodeURIComponent(path + req.nextUrl.search)}` : "";
    const redirect = NextResponse.redirect(url);
    for (const c of res.cookies.getAll()) redirect.cookies.set(c);
    res = redirect;
  }

  if (!req.cookies.get("specter_device")) {
    res.cookies.set("specter_device", crypto.randomUUID(), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 * 2 });
  }
  return res;
}
