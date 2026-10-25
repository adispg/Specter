import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, readJson, withSession } from "@/lib/api";
import { env } from "@/lib/env";
import { PERSONAS } from "@/lib/personas/config";
import { PersonaIdSchema } from "@/lib/consult/schema";
import { checkQuota, windowStart } from "@/lib/ratelimit";
import { prepareSpeech, speechHash, speedFor, synthesizeElevenLabs, synthesizeMock, voiceIdFor, type SpeechInput } from "@/lib/tts/speech";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z
  .object({
    consultId: z.string().min(1).optional(),
    sample: z.object({ persona: PersonaIdSchema, kind: z.enum(["greeting", "example"]) }).optional(),
    pace: z.number().min(0.8).max(1.2).default(1),
    readPlay: z.boolean().optional(),
  })
  .refine((b) => Boolean(b.consultId) !== Boolean(b.sample), "Send a consultId or a sample.");

/**
 * POST /api/tts
 * Speaks a stored consult (only the user's own) or a config sample, never arbitrary
 * text. Pause marks become ElevenLabs break tags with per-persona lengths; returns
 * base64 audio plus the word and pause timeline for lighting. Cached per user by
 * hash of (text, voice, speed, model), so replays are free. 501 when TTS is not
 * configured: the client falls back to the browser voice.
 */
export const POST = withSession(async (session, req) => {
  if (!env.ttsConfigured()) return jsonError("tts_unavailable", "Voice is not configured.", 501);
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("bad_request", parsed.error.issues[0]?.message ?? "Bad request.", 400);
  const body = parsed.data;
  const profile = await session.store.getProfile();

  let input: SpeechInput;
  let caseId: string | null = null;
  if (body.consultId) {
    const consult = await session.store.getConsult(body.consultId);
    if (!consult) return jsonError("not_found", "That reply doesn't exist.", 404);
    caseId = consult.case_id;
    const care = consult.mode === "care";
    input = {
      persona: consult.persona,
      line: consult.reply.line,
      followup: consult.reply.followup,
      extra: body.readPlay && !care ? consult.reply.play : undefined,
      pace: body.pace,
      care,
      voiceId: profile.settings.voices?.[consult.persona] ?? null,
    };
  } else {
    const s = body.sample!;
    const p = PERSONAS[s.persona];
    input =
      s.kind === "greeting"
        ? { persona: s.persona, line: p.greeting, followup: "", pace: body.pace, voiceId: profile.settings.voices?.[s.persona] ?? null }
        : { persona: s.persona, line: p.example.reply.line, followup: p.example.reply.followup, pace: body.pace, voiceId: profile.settings.voices?.[s.persona] ?? null };
  }

  const model = env.mockAI() ? "mock" : env.elevenLabsModel();
  const { text } = prepareSpeech(input);
  const voice = voiceIdFor(input.persona, input.voiceId, input.care);
  const hash = speechHash(text, voice, speedFor(input), model);
  const cached = await session.store.getAudio(hash).catch(() => null);
  if (cached) {
    return NextResponse.json({ audio: cached.audio_b64, mime: cached.mime, timeline: cached.timeline, source: "cache" });
  }

  const used = await session.store.countUsage("tts", windowStart(new Date(), "day"));
  const q = checkQuota(used, env.ttsDailyCap());
  if (!q.allowed) return jsonError("rate_limited", "Voice is resting for today. Here it is in writing.", 429, { "Retry-After": String(q.retryAfter) });

  const result = env.mockAI() ? synthesizeMock(input) : await synthesizeElevenLabs(input, { apiKey: env.elevenLabsKey(), model });
  await session.store.recordUsage("tts", { chars: result.chars, persona: input.persona, model });
  await session.store
    .putAudio({ hash, case_id: caseId, mime: result.mime, audio_b64: result.audio, timeline: result.timeline, chars: result.chars })
    .catch(() => undefined);
  return NextResponse.json({ audio: result.audio, mime: result.mime, timeline: result.timeline, source: result.source });
});
