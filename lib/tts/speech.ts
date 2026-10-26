import { createHash } from "node:crypto";
import { CARE_VOICE, PERSONAS, type PersonaId } from "@/lib/personas/config";
import { parseSpoken, toElevenLabsText, type PauseLengths, type SpokenScript } from "@/lib/spoken";
import { estimateTimeline, timelineFromAlignment, type Alignment, type Timeline } from "@/lib/timings";
import { squish } from "@/lib/text";

export type SpeechResult = {
  /** Base64 audio. */
  audio: string;
  mime: string;
  timeline: Timeline;
  source: "elevenlabs" | "deepgram" | "mock" | "cache";
  voice: string;
  chars: number;
};

export class TtsError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export type SpeechInput = {
  persona: PersonaId;
  line: string;
  followup: string;
  /** Extra plain sentences read after the follow-up (the play, when "read the play aloud" is on). */
  extra?: string[];
  pace: number;
  /** Care mode: neutral calm voice, no pause theatrics. */
  care?: boolean;
  /** User's chosen stock voice for this persona (validated against config). */
  voiceId?: string | null;
};

/** Pause lengths in seconds; a faster pace also tightens the silences. */
export function pauseLengthsFor(persona: PersonaId, pace = 1): PauseLengths {
  const g = PERSONAS[persona].voice.gaps;
  const k = 1 / Math.min(1.25, Math.max(0.75, pace));
  return { short: Math.round((g.short / 1000) * k * 100) / 100, long: Math.round((g.long / 1000) * k * 100) / 100 };
}

/** Only stock voices listed in config (or the env default) are ever used. */
/** The scaffolded env vars still hold REPLACE_WITH_... placeholders, which are
 *  truthy and would be sent to the provider as a voice id. Ignore them so the
 *  curated stock voice in config wins until a real id is set. */
function envVoice(name: string): string | null {
  const v = process.env[name]?.trim();
  if (!v || v.startsWith("REPLACE_WITH")) return null;
  return v;
}

export function voiceIdFor(persona: PersonaId, chosen?: string | null, care = false): string {
  if (care) return envVoice(CARE_VOICE.envVoiceId) ?? CARE_VOICE.id;
  const v = PERSONAS[persona].voice;
  if (chosen && v.options.some((o) => o.id === chosen)) return chosen;
  return envVoice(v.envVoiceId) ?? v.options[0]!.id;
}

/** Build the script and the exact text sent to TTS. Care mode has no marks and plain gaps. */
export function prepareSpeech(input: SpeechInput): { script: SpokenScript; lengths: PauseLengths; text: string; words: string[] } {
  const lengths = input.care ? { short: 0.3, long: 0.6 } : pauseLengthsFor(input.persona, input.pace);
  const strip = (s: string) => squish(s.replace(/\|+/g, " "));
  const script = input.care ? parseSpoken(strip(input.line), strip(input.followup)) : parseSpoken(input.line, input.followup);
  const built = toElevenLabsText(script, lengths);
  let text = built.text;
  const extra = (input.extra ?? []).map(strip).filter(Boolean).slice(0, 3);
  if (extra.length) text += ` <break time="${lengths.long}s" /> ` + extra.join(` <break time="${lengths.short}s" /> `);
  return { script, lengths, text, words: built.words };
}

export function speechHash(text: string, voice: string, speed: number, model: string): string {
  return createHash("sha256").update(`${model}|${voice}|${speed.toFixed(2)}|${text}`).digest("hex");
}

export function speedFor(input: SpeechInput): number {
  const base = input.care ? CARE_VOICE.speed : PERSONAS[input.persona].voice.speed;
  return Math.round(Math.min(1.2, Math.max(0.7, base * (input.care ? 1 : input.pace))) * 100) / 100;
}

/**
 * ElevenLabs text-to-speech with timestamps. Pause marks become break tags with the
 * persona's lengths; the character alignment is mapped back to word and pause timings.
 */
export async function synthesizeElevenLabs(input: SpeechInput, opts: { apiKey: string; model: string }): Promise<SpeechResult> {
  const { script, lengths, text, words } = prepareSpeech(input);
  const voiceId = voiceIdFor(input.persona, input.voiceId, input.care);
  const cfg = PERSONAS[input.persona].voice;
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=mp3_44100_64`, {
    method: "POST",
    headers: { "content-type": "application/json", "xi-api-key": opts.apiKey, accept: "application/json" },
    body: JSON.stringify({
      text,
      model_id: opts.model,
      voice_settings: {
        stability: input.care ? 0.7 : cfg.stability,
        similarity_boost: cfg.similarityBoost,
        style: input.care ? 0 : cfg.style,
        use_speaker_boost: true,
        speed: speedFor(input),
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new TtsError(`ElevenLabs TTS ${res.status}: ${body.slice(0, 200)}`, res.status === 429 ? 429 : 502);
  }
  const data = (await res.json()) as { audio_base64?: string; alignment?: Alignment | null; normalized_alignment?: Alignment | null };
  if (!data.audio_base64) throw new TtsError("ElevenLabs returned no audio", 502);
  let timeline = timelineFromAlignment(script, words, data.alignment, lengths);
  if ((timeline.matched ?? 0) < words.length * 0.6 && data.normalized_alignment) {
    const alt = timelineFromAlignment(script, words, data.normalized_alignment, lengths);
    if ((alt.matched ?? 0) > (timeline.matched ?? 0)) timeline = alt;
  }
  return { audio: data.audio_base64, mime: "audio/mpeg", timeline, source: "elevenlabs", voice: voiceId, chars: text.length };
}

/**
 * Deepgram Aura voices, one per persona, cast to the archetype rather than
 * imitating any real person. Every one is a Deepgram stock voice.
 *
 *   closer   zeus     deep, trustworthy, smooth. The senior partner.
 *   prodigy  apollo   confident, comfortable, casual. The quick young associate.
 *   insider  hera     smooth, warm, professional. Reads the room.
 *   care     harmonia empathetic, clear, calm. No persona in care mode.
 *
 * Override any of them with DEEPGRAM_VOICE_CLOSER, _PRODIGY, _INSIDER, _CARE.
 */
export const AURA_VOICES: Record<PersonaId | "care", { env: string; model: string }> = {
  closer: { env: "DEEPGRAM_VOICE_CLOSER", model: "aura-2-zeus-en" },
  prodigy: { env: "DEEPGRAM_VOICE_PRODIGY", model: "aura-2-apollo-en" },
  insider: { env: "DEEPGRAM_VOICE_INSIDER", model: "aura-2-hera-en" },
  care: { env: "DEEPGRAM_VOICE_CARE", model: "aura-2-harmonia-en" },
};

export function auraModelFor(persona: PersonaId, care = false): string {
  const slot = AURA_VOICES[care ? "care" : persona];
  return envVoice(slot.env) ?? slot.model;
}

/**
 * Deepgram Aura. Unlike ElevenLabs it returns audio only, with no word
 * alignment, so the timeline is estimated from the script the same way the
 * mock path does. Playback highlights by estimate rather than true timings.
 */
export async function synthesizeDeepgramAura(input: SpeechInput, opts: { apiKey: string }): Promise<SpeechResult> {
  const { script, lengths, text } = prepareSpeech(input);
  const model = auraModelFor(input.persona, input.care);
  const res = await fetch(`https://api.deepgram.com/v1/speak?model=${encodeURIComponent(model)}&encoding=mp3`, {
    method: "POST",
    headers: { Authorization: `Token ${opts.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new TtsError(`Deepgram Aura ${res.status}: ${body.slice(0, 200)}`, res.status === 429 ? 429 : 502);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0) throw new TtsError("Deepgram Aura returned no audio", 502);
  // Aura has no speed control, so the pace setting shapes the gaps only.
  const timeline = estimateTimeline(script, lengths, input.care ? 1 : input.pace);
  return { audio: buf.toString("base64"), mime: "audio/mpeg", timeline, source: "deepgram", voice: model, chars: text.length };
}

/** Deterministic mock: a silent WAV as long as the estimated timeline. */
export function synthesizeMock(input: SpeechInput): SpeechResult {
  const { script, lengths, text } = prepareSpeech(input);
  const timeline = estimateTimeline(script, lengths, input.care ? 1 : input.pace);
  return { audio: silentWav(timeline.duration).toString("base64"), mime: "audio/wav", timeline, source: "mock", voice: "mock", chars: text.length };
}

/** 8 kHz, 8-bit mono PCM silence. */
export function silentWav(seconds: number): Buffer {
  const rate = 8000;
  const n = Math.max(1, Math.round(rate * Math.min(60, Math.max(0.1, seconds))));
  const buf = Buffer.alloc(44 + n);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate, 28);
  buf.writeUInt16LE(1, 32);
  buf.writeUInt16LE(8, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n, 40);
  buf.fill(128, 44);
  return buf;
}

/** ElevenLabs speech-to-text (Scribe). */
export async function transcribeElevenLabs(opts: { apiKey: string; model: string; audio: Blob; filename: string }): Promise<string> {
  const form = new FormData();
  form.append("model_id", opts.model);
  form.append("file", opts.audio, opts.filename);
  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": opts.apiKey }, body: form });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new TtsError(`ElevenLabs STT ${res.status}: ${body.slice(0, 200)}`, res.status === 429 ? 429 : 502);
  }
  const data = (await res.json()) as { text?: string };
  return (data.text ?? "").trim();
}
