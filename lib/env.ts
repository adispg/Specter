import { BRAND } from "@/lib/personas/config";

/**
 * Server-side environment. Read lazily (functions, not constants) so values set at
 * runtime (next start, Vercel) are honoured and tests can override process.env.
 */

const truthy = (v: string | undefined) => v === "1" || v?.toLowerCase() === "true";

function int(name: string, fallback: number): number {
  const n = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export const env = {
  /** Deterministic fixtures for consult, tts and stt. No keys needed. */
  mockAI: () => truthy(process.env.MOCK_AI),

  supabaseUrl: () => process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseConfigured: () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),

  /**
   * Test-user sign-in without Supabase. Only in mock mode, either forced with
   * MOCK_AUTH=1 or because Supabase is not configured. Never on a Vercel production deploy.
   */
  mockAuth: () => {
    if (process.env.VERCEL_ENV === "production") return false;
    if (!truthy(process.env.MOCK_AI)) return false;
    return truthy(process.env.MOCK_AUTH) || !(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  },

  /** Gemini (primary LLM). Free tier: 1500 req/day, 1M tokens/min on gemini-2.0-flash. */
  geminiKey: () => process.env.GEMINI_API_KEY ?? "",
  geminiModel: () => process.env.GEMINI_MODEL || "gemini-2.0-flash",

  /** ElevenLabs (TTS only). STT has been moved to Deepgram. */
  elevenLabsKey: () => process.env.ELEVENLABS_API_KEY ?? "",
  elevenLabsModel: () => process.env.ELEVENLABS_MODEL || "eleven_flash_v2_5",
  ttsConfigured: () => truthy(process.env.MOCK_AI) || Boolean(process.env.ELEVENLABS_API_KEY),

  /** Deepgram (STT). Free tier: 12,000 min/year on Nova-3. */
  deepgramKey: () => process.env.DEEPGRAM_API_KEY ?? "",
  sttConfigured: () => truthy(process.env.MOCK_AI) || Boolean(process.env.DEEPGRAM_API_KEY),

  /** Free tier: billable consults per week. 0 disables the weekly quota. */
  freeConsultsPerWeek: () => int("FREE_CONSULTS_PER_WEEK", 3),
  /** Follow-ups, another takes and persona switches free per case before they count. */
  freeFollowupsPerCase: () => int("FREE_FOLLOWUPS_PER_CASE", 5),
  /** Hard daily caps per user (abuse and cost guard), for every plan. */
  consultDailyCap: () => int("CONSULT_DAILY_CAP", 40),
  ttsDailyCap: () => int("TTS_DAILY_CAP", 150),
  sttDailyCap: () => int("STT_DAILY_CAP", 100),
  /** Guest consults (new cases) before sign in. */
  guestConsults: () => int("GUEST_CONSULTS", 1),
  /** Guest consults per device and per IP in 24 hours. */
  guestPerDevice: () => int("GUEST_CONSULTS_PER_DEVICE_PER_DAY", 1),
  guestPerIp: () => int("GUEST_CONSULTS_PER_IP_PER_DAY", 5),
  /** Shows the paywall stub when the free tier runs out. */
  paywallEnabled: () => process.env.PAYWALL_ENABLED !== "0",
  /** Salt for hashing guest IP and device keys. */
  hashSalt: () => process.env.GUEST_HASH_SALT || "specter-dev-salt",
};

/** Flags safe to send to the browser. */
export type PublicConfig = {
  ttsEnabled: boolean;
  sttEnabled: boolean;
  mock: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
  freeConsultsPerWeek: number;
  authMode: "mock" | "supabase" | "unconfigured";
  paywall: boolean;
};

export function publicConfig(): PublicConfig {
  return {
    ttsEnabled: env.ttsConfigured(),
    sttEnabled: env.sttConfigured(),
    mock: env.mockAI(),
    supabaseUrl: env.supabaseUrl(),
    supabaseAnonKey: env.supabaseAnonKey(),
    freeConsultsPerWeek: env.freeConsultsPerWeek(),
    authMode: env.mockAuth() ? "mock" : env.supabaseConfigured() ? "supabase" : "unconfigured",
    paywall: env.paywallEnabled() && BRAND.paywall,
  };
}
