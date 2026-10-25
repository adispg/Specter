import { NextResponse } from "next/server";
import { jsonError, withSession } from "@/lib/api";
import { env } from "@/lib/env";
import { MOCK_TRANSCRIPT } from "@/lib/consult/mock";
import { checkQuota, windowStart } from "@/lib/ratelimit";
import { transcribeDeepgram } from "@/lib/tts/deepgram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * POST /api/stt (multipart, field "audio")
 * Fallback speech-to-text for browsers without the Web Speech API. The audio is
 * transcribed and discarded; it is never stored.
 */
export const POST = withSession(async (session, req) => {
  if (!env.sttConfigured()) return jsonError("stt_unavailable", "Voice input is not configured. Type instead.", 501);
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError("bad_request", "Send the recording as multipart form data.", 400);
  }
  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) return jsonError("bad_request", "No audio received.", 400);
  if (audio.size > MAX_BYTES) return jsonError("too_large", "That recording is too long. Keep it under a minute or two.", 413);

  const used = await session.store.countUsage("stt", windowStart(new Date(), "day"));
  const q = checkQuota(used, env.sttDailyCap());
  if (!q.allowed) return jsonError("rate_limited", "Voice input is resting for today. Type instead.", 429);

  const text = env.mockAI()
    ? MOCK_TRANSCRIPT
    : await transcribeDeepgram({
        apiKey: env.deepgramKey(),
        audio,
        filename: (audio as File).name || "speech.webm",
      });
  await session.store.recordUsage("stt", { bytes: audio.size });
  return NextResponse.json({ text });
});
