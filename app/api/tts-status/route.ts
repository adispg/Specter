import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * GET /api/tts-status
 * Diagnostic: returns what the server sees for TTS config.
 * Does NOT return keys or secrets, just booleans.
 * Safe to call from a browser on Android to diagnose voice issues.
 */
export async function GET() {
  return NextResponse.json({
    ttsConfigured: env.ttsConfigured(),
    provider: env.ttsProvider(),
    hasDeepgramKey: Boolean(process.env.DEEPGRAM_API_KEY),
    hasElevenLabsKey: Boolean(process.env.ELEVENLABS_API_KEY),
    mockAI: env.mockAI(),
    vercelEnv: process.env.VERCEL_ENV ?? "not-vercel",
  });
}
