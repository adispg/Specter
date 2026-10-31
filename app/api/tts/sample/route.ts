import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { env } from "@/lib/env";
import { PERSONAS } from "@/lib/personas/config";
import { PersonaIdSchema } from "@/lib/consult/schema";
import { jsonError } from "@/lib/api";
import { log } from "@/lib/logger";
import {
  auraModelFor,
  prepareSpeech,
  speechHash,
  speedFor,
  synthesizeDeepgramAura,
  synthesizeElevenLabs,
  synthesizeMock,
  voiceIdFor,
} from "@/lib/tts/speech";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Simple in-process IP rate limit for the sample endpoint.
// 3 sample plays per IP per minute is generous for onboarding.
const ipHits = new Map<string, { count: number; resetAt: number }>();
function checkIpLimit(ip: string): boolean {
  const now = Date.now();
  const window = 60_000; // 1 minute
  const limit = 12; // 12 samples per IP per minute
  const slot = ipHits.get(ip);
  if (!slot || slot.resetAt <= now) {
    ipHits.set(ip, { count: 1, resetAt: now + window });
    return true;
  }
  if (slot.count >= limit) return false;
  slot.count++;
  return true;
}

// In-process cache so repeated taps on the same persona card are instant.
const sampleCache = new Map<string, { audio: string; mime: string }>();

/**
 * GET /api/tts/sample?persona=closer
 *
 * Public (no session required). Returns a base64 greeting audio sample for the
 * welcome / onboarding persona picker so users can hear the voice before choosing.
 *
 * Rate-limited per IP (12 per minute) to prevent abuse. Not persisted to the
 * database. Falls back to 501 when TTS is not configured.
 */
export async function GET(req: Request) {
  if (!env.ttsConfigured()) {
    return jsonError("tts_unavailable", "Voice is not configured.", 501);
  }

  const { searchParams } = new URL(req.url);
  const rawPersona = searchParams.get("persona");
  const parsed = PersonaIdSchema.safeParse(rawPersona);
  if (!parsed.success) {
    return jsonError("bad_request", "persona must be one of: closer, prodigy, insider.", 400);
  }
  const persona = parsed.data;

  // IP rate-limit
  const headersList = await headers();
  const ip =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headersList.get("x-real-ip") ??
    "unknown";
  if (!checkIpLimit(ip)) {
    return jsonError("rate_limited", "Too many sample requests. Wait a moment.", 429);
  }

  const p = PERSONAS[persona];
  const input = {
    persona,
    line: p.greeting,
    followup: "",
    pace: 1,
    voiceId: null as null | string,
  };

  const provider = env.mockAI() ? "mock" : env.ttsProvider();
  const model =
    provider === "mock"
      ? "mock"
      : provider === "deepgram"
        ? auraModelFor(persona, false)
        : env.elevenLabsModel();
  const { text } = prepareSpeech(input);
  const voice =
    provider === "deepgram" ? model : voiceIdFor(persona, null, false);
  const hash = speechHash(text, voice, speedFor(input), model);

  // In-process cache (survives for the lifetime of this serverless instance)
  const hit = sampleCache.get(hash);
  if (hit) {
    return NextResponse.json({ audio: hit.audio, mime: hit.mime });
  }

  try {
    const result =
      provider === "mock"
        ? synthesizeMock(input)
        : provider === "deepgram"
          ? await synthesizeDeepgramAura(input, { apiKey: env.deepgramKey() })
          : await synthesizeElevenLabs(input, {
              apiKey: env.elevenLabsKey(),
              model,
            });

    sampleCache.set(hash, { audio: result.audio, mime: result.mime });
    return NextResponse.json({ audio: result.audio, mime: result.mime });
  } catch (e) {
    log.error("tts.sample_failed", { message: e instanceof Error ? e.message.slice(0, 300) : String(e).slice(0, 300) });
    return jsonError("tts_failed", "Could not generate sample. Try again.", 502);
  }
}
