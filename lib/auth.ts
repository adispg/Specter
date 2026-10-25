import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { env } from "@/lib/env";
import { MemoryGuestThrottle, MemoryStore } from "@/lib/data/memory";
import { SupabaseGuestThrottle, SupabaseStore } from "@/lib/data/supabase";
import type { DataStore, GuestThrottle } from "@/lib/data/store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Mock mode session cookie: an email for a test user, or "guest:<uuid>" for a guest. */
export const MOCK_USER_COOKIE = "specter_test_user";
/** Random per-browser id used to throttle guest consults per device. */
export const DEVICE_COOKIE = "specter_device";
/** Set once onboarding is finished on this device (splash routing: onboarding vs sign in). */
export const SEEN_COOKIE = "specter_seen";

export type SessionUser = { id: string; email: string | null; isGuest: boolean; provider: string | null };
export type Session = { user: SessionUser; store: DataStore; throttle: GuestThrottle; mode: "supabase" | "mock" };

/** Stable uuid-shaped id derived from a test identity. */
export function mockUserId(identity: string): string {
  const h = createHash("sha256").update(`specter:${identity.toLowerCase()}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(email);
}

export function newGuestIdentity(): string {
  return `guest:${randomUUID()}`;
}

function parseMockIdentity(v: string | undefined): SessionUser | null {
  if (!v) return null;
  if (v.startsWith("guest:") && /^guest:[0-9a-f-]{36}$/.test(v)) return { id: mockUserId(v), email: null, isGuest: true, provider: "anonymous" };
  if (isValidEmail(v)) return { id: mockUserId(v), email: v, isGuest: false, provider: "email" };
  return null;
}

/** The signed-in user (or guest) and a data store bound to them, or null. */
export async function getSession(): Promise<Session | null> {
  if (env.mockAuth()) {
    const jar = await cookies();
    const user = parseMockIdentity(jar.get(MOCK_USER_COOKIE)?.value);
    if (!user) return null;
    return { user, store: new MemoryStore(user.id), throttle: new MemoryGuestThrottle(), mode: "mock" };
  }
  if (!env.supabaseConfigured()) return null;
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  const isGuest = Boolean((user as { is_anonymous?: boolean }).is_anonymous);
  return {
    user: { id: user.id, email: user.email ?? null, isGuest, provider: isGuest ? "anonymous" : ((user.app_metadata?.provider as string) ?? "email") },
    store: new SupabaseStore(sb, user.id),
    throttle: new SupabaseGuestThrottle(sb),
    mode: "supabase",
  };
}

export type AuthMode = "mock" | "supabase" | "unconfigured";

export function authMode(): AuthMode {
  if (env.mockAuth()) return "mock";
  if (env.supabaseConfigured()) return "supabase";
  return "unconfigured";
}

function hashKey(v: string): string {
  return createHash("sha256").update(`${env.hashSalt()}:${v}`).digest("hex").slice(0, 40);
}

/** Hashed device and IP keys for the guest throttle; raw values are never stored. */
export async function guestKeys(): Promise<{ deviceKey: string | null; ipKey: string | null }> {
  const jar = await cookies();
  const h = await headers();
  const device = jar.get(DEVICE_COOKIE)?.value ?? null;
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim();
  return { deviceKey: device ? hashKey(`d:${device}`) : null, ipKey: ip ? hashKey(`i:${ip}`) : null };
}

/** Best-effort country from the edge (Vercel) or the browser language. */
export async function requestCountry(): Promise<string | null> {
  const h = await headers();
  const geo = h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry");
  if (geo && /^[A-Z]{2}$/.test(geo)) return geo;
  const lang = h.get("accept-language") ?? "";
  const m = lang.match(/^[a-z]{2,3}-([A-Z]{2})/);
  return m?.[1] ?? null;
}
