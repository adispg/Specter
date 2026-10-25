"use client";
/**
 * Voice in. Browser Web Speech API first (live transcript); otherwise record with
 * MediaRecorder and transcribe on the server (/api/stt, ElevenLabs Scribe).
 * One gesture model (design review B7): tap to start, tap again or pause to finish.
 */

export type DictationError = "denied" | "unsupported" | "no-speech" | "network" | "failed";

export type DictationHandlers = {
  onText?: (final: string, interim: string) => void;
  /** Called once with the final transcript (may be empty). */
  onEnd: (text: string) => void;
  onError: (e: DictationError) => void;
  /** 0..1 microphone level, only in the recorder path. */
  onLevel?: (level: number) => void;
  onState?: (s: "listening" | "transcribing") => void;
};

export type DictationOptions = { sttEnabled: boolean; silenceMs?: number; noSpeechMs?: number; minChars?: number };

type SR = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function speechRecognitionCtor(): (new () => SR) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function dictationSupported(sttEnabled: boolean): boolean {
  if (speechRecognitionCtor()) return true;
  return sttEnabled && typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

export type DictationSession = { stop: () => void; cancel: () => void };

export function startDictation(h: DictationHandlers, opts: DictationOptions): DictationSession {
  const silenceMs = opts.silenceMs ?? 1600;
  const noSpeechMs = opts.noSpeechMs ?? 8000;
  const minChars = opts.minChars ?? 8;
  const Ctor = speechRecognitionCtor();
  if (Ctor) return startWebSpeech(Ctor, h, { silenceMs, noSpeechMs, minChars, sttEnabled: opts.sttEnabled });
  if (opts.sttEnabled && typeof MediaRecorder !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function") return startRecorder(h, { silenceMs, noSpeechMs });
  queueMicrotask(() => h.onError("unsupported"));
  return { stop() {}, cancel() {} };
}

function startWebSpeech(
  Ctor: new () => SR,
  h: DictationHandlers,
  o: { silenceMs: number; noSpeechMs: number; minChars: number; sttEnabled: boolean },
): DictationSession {
  const rec = new Ctor();
  rec.lang = navigator.language || "en-US";
  rec.interimResults = true;
  rec.continuous = true;
  let finalText = "";
  let interim = "";
  let ended = false;
  let cancelled = false;
  let silence: ReturnType<typeof setTimeout> | null = null;
  const noSpeech = setTimeout(() => {
    if (!finalText && !interim) {
      cancelled = true;
      rec.abort();
      h.onError("no-speech");
    }
  }, o.noSpeechMs);
  const end = () => {
    if (ended) return;
    ended = true;
    clearTimeout(noSpeech);
    if (silence) clearTimeout(silence);
    if (!cancelled) h.onEnd(`${finalText} ${interim}`.trim());
  };
  rec.onresult = (e) => {
    finalText = "";
    interim = "";
    for (let i = 0; i < e.results.length; i++) {
      const r = e.results[i]!;
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    h.onText?.(finalText.trim(), interim.trim());
    if (silence) clearTimeout(silence);
    if (`${finalText}${interim}`.trim().length >= o.minChars) silence = setTimeout(() => rec.stop(), o.silenceMs);
  };
  rec.onerror = (e) => {
    if (e.error === "aborted") return;
    cancelled = true;
    clearTimeout(noSpeech);
    if (e.error === "not-allowed" || e.error === "service-not-allowed" || e.error === "audio-capture") h.onError("denied");
    else if (e.error === "no-speech") h.onError("no-speech");
    else if (e.error === "network") h.onError("network");
    else h.onError("failed");
  };
  rec.onend = end;
  try {
    rec.start();
    h.onState?.("listening");
  } catch {
    queueMicrotask(() => h.onError("failed"));
  }
  return {
    stop: () => rec.stop(),
    cancel: () => {
      cancelled = true;
      rec.abort();
      end();
    },
  };
}

function startRecorder(h: DictationHandlers, o: { silenceMs: number; noSpeechMs: number }): DictationSession {
  let stream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let ctx: AudioContext | null = null;
  let raf = 0;
  let cancelled = false;
  let stopped = false;
  const chunks: Blob[] = [];
  let heard = false;
  let quietSince = 0;
  const t0 = performance.now();

  const cleanup = () => {
    cancelAnimationFrame(raf);
    stream?.getTracks().forEach((t) => t.stop());
    void ctx?.close().catch(() => undefined);
  };

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    else cleanup();
  };

  navigator.mediaDevices
    .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    .then((s) => {
      if (cancelled) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      stream = s;
      const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((m) => MediaRecorder.isTypeSupported?.(m));
      recorder = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      recorder.onstop = async () => {
        cleanup();
        if (cancelled) return;
        if (!heard) return h.onError("no-speech");
        h.onState?.("transcribing");
        try {
          const blob = new Blob(chunks, { type: recorder?.mimeType || "audio/webm" });
          const form = new FormData();
          form.append("audio", blob, blob.type.includes("mp4") ? "speech.mp4" : "speech.webm");
          const res = await fetch("/api/stt", { method: "POST", body: form });
          if (!res.ok) throw new Error(String(res.status));
          const data = (await res.json()) as { text?: string };
          h.onEnd((data.text ?? "").trim());
        } catch {
          h.onError("network");
        }
      };
      recorder.start(250);
      h.onState?.("listening");
      // Level meter and end-of-turn detection.
      try {
        ctx = new AudioContext();
        const src = ctx.createMediaStreamSource(s);
        const an = ctx.createAnalyser();
        an.fftSize = 1024;
        src.connect(an);
        const buf = new Uint8Array(an.fftSize);
        const loop = () => {
          an.getByteTimeDomainData(buf);
          let sum = 0;
          for (const v of buf) sum += ((v - 128) / 128) ** 2;
          const rms = Math.sqrt(sum / buf.length);
          const level = Math.min(1, rms * 6);
          h.onLevel?.(level);
          const now = performance.now();
          if (level > 0.12) {
            heard = true;
            quietSince = 0;
          } else if (heard) {
            quietSince ||= now;
            if (now - quietSince > o.silenceMs) return stop();
          }
          if (!heard && now - t0 > o.noSpeechMs) return stop();
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      } catch {
        heard = true; // no analyser: rely on the user's tap to finish
      }
    })
    .catch(() => {
      if (!cancelled) h.onError("denied");
    });

  return {
    stop,
    cancel: () => {
      cancelled = true;
      stop();
      cleanup();
    },
  };
}
