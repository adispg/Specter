"use client";
/**
 * The speech performer: plays a reply and reports which words are lit and which
 * pause mark glows. Timing sources in priority order (design-system.md 6.5):
 *  1. ElevenLabs audio with character alignment (server /api/tts).
 *  2. Browser speechSynthesis with word boundary events, segment by segment, with
 *     the persona's gaps at each pause mark.
 *  3. An estimate (160 wpm times pace) when boundary events don't arrive.
 * One performer per page; starting a new performance stops the current one.
 */
import { PERSONAS, type PersonaId } from "@/lib/personas/config";
import { parseSpoken, type SpokenScript } from "@/lib/spoken";
import { progressAt, type Timeline } from "@/lib/timings";

export type PerformState = "idle" | "loading" | "speaking" | "pausing";
export type Progress = { wordsLit: number; activePause: number | null };
export type VoiceSource = "elevenlabs" | "deepgram" | "mock" | "cache" | "browser" | "none";
/** Last TTS error when server speech failed and the performer fell back to browser. */
export type TtsFallbackReason = { status: number; message: string } | null;

export type PerformRequest = {
  persona: PersonaId;
  line: string;
  followup: string;
  care?: boolean;
  pace: number;
  /** Server TTS: a consult id or a config sample. Omit to use the browser voice only. */
  tts?: { consultId?: string; sample?: { persona: PersonaId; kind: "greeting" | "example" }; readPlay?: boolean } | null;
  browserVoice?: string | null;
};

export type PerformResult = "done" | "stopped" | "failed";

type Listener = (s: { state: PerformState; progress: Progress; source: VoiceSource; performing: boolean; ttsFallback: TtsFallbackReason }) => void;

const audioCache = new Map<string, { url: string; timeline: Timeline; source: VoiceSource }>();

class Performer {
  private token = 0;
  private audio: HTMLAudioElement | null = null;
  private raf = 0;
  private listeners = new Set<Listener>();
  state: PerformState = "idle";
  progress: Progress = { wordsLit: 0, activePause: null };
  source: VoiceSource = "none";
  performing = false;
  /** Identifies what is playing so only the matching card lights up. */
  currentKey: string | null = null;
  /** Set when server TTS failed and we fell back to browser speech. Cleared on next play. */
  ttsFallback: TtsFallbackReason = null;

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  private emit() {
    for (const l of this.listeners) l({ state: this.state, progress: this.progress, source: this.source, performing: this.performing, ttsFallback: this.ttsFallback });
  }

  private set(state: PerformState, progress?: Progress) {
    this.state = state;
    if (progress) this.progress = progress;
    this.emit();
  }

  /** Call inside a user gesture (tap) so iOS lets audio and speech start later. */
  unlock() {
    try {
      if (!this.audio && typeof Audio !== "undefined") {
        this.audio = new Audio();
        this.audio.preload = "auto";
        this.audio.src = "data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQIAAACAgA==";
        void this.audio.play().then(() => this.audio?.pause()).catch(() => undefined);
      }
      const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
      if (synth && !synth.speaking) {
        const u = new SpeechSynthesisUtterance(" ");
        u.volume = 0;
        synth.speak(u);
      }
    } catch {
      // Unlocking is best effort.
    }
  }

  stop() {
    this.token++;
    cancelAnimationFrame(this.raf);
    if (this.audio) {
      this.audio.pause();
      this.audio.onended = null;
    }
    try {
      window.speechSynthesis?.cancel();
    } catch {
      // ignore
    }
    this.performing = false;
    this.currentKey = null;
    this.set("idle");
  }

  async perform(key: string, req: PerformRequest): Promise<PerformResult> {
    this.stop();
    const tok = ++this.token;
    this.currentKey = key;
    const script = req.care ? parseSpoken(req.line.replace(/\|+/g, " "), req.followup.replace(/\|+/g, " ")) : parseSpoken(req.line, req.followup);
    this.performing = true;
    this.source = "none";
    this.ttsFallback = null;
    this.set("loading", { wordsLit: 0, activePause: null });

    if (req.tts) {
      try {
        const clip = await this.fetchClip(req);
        if (tok !== this.token) return "stopped";
        return await this.playClip(tok, clip);
      } catch (err) {
        if (tok !== this.token) return "stopped";
        // Server TTS failed; record why and fall through to the browser voice.
        const msg = err instanceof Error ? err.message : String(err);
        const status = /tts (\d+)/.exec(msg)?.[1];
        this.ttsFallback = { status: status ? Number(status) : 0, message: msg };
        this.emit();
      }
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      return this.speakBrowser(tok, script, req);
    }
    this.finish(tok, script.wordCount);
    return "failed";
  }

  private async fetchClip(req: PerformRequest) {
    const body = { ...req.tts, pace: req.pace };
    const cacheKey = JSON.stringify(body);
    const hit = audioCache.get(cacheKey);
    if (hit) return { ...hit, source: "cache" as VoiceSource };
    const res = await fetch("/api/tts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`tts ${res.status}`);
    const data = (await res.json()) as { audio: string; mime: string; timeline: Timeline; source: VoiceSource };
    const bytes = Uint8Array.from(atob(data.audio), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: data.mime }));
    const clip = { url, timeline: data.timeline, source: data.source };
    audioCache.set(cacheKey, clip);
    return clip;
  }

  private playClip(tok: number, clip: { url: string; timeline: Timeline; source: VoiceSource }): Promise<PerformResult> {
    return new Promise((resolve) => {
      const audio = this.audio ?? new Audio();
      this.audio = audio;
      audio.src = clip.url;
      this.source = clip.source;
      let started = false;
      const tick = () => {
        if (tok !== this.token) return;
        const p = progressAt(clip.timeline, audio.currentTime);
        const state: PerformState = p.activePause !== null ? "pausing" : "speaking";
        if (started && (p.wordsLit !== this.progress.wordsLit || p.activePause !== this.progress.activePause || state !== this.state)) this.set(state, p);
        this.raf = requestAnimationFrame(tick);
      };
      audio.onended = () => {
        if (tok !== this.token) return resolve("stopped");
        const words = clip.timeline.entries.filter((e) => e.type === "word").length;
        this.finish(tok, words);
        resolve("done");
      };
      audio.onplaying = () => {
        if (!started) {
          started = true;
          this.set("speaking");
        }
      };
      audio.play().then(
        () => {
          this.raf = requestAnimationFrame(tick);
        },
        () => {
          if (tok !== this.token) return resolve("stopped");
          // Autoplay blocked or decode failure: run the lighting silently on the timeline.
          this.source = "none";
          this.runTimelineSilently(tok, clip.timeline).then(resolve);
        },
      );
    });
  }

  private runTimelineSilently(tok: number, timeline: Timeline): Promise<PerformResult> {
    return new Promise((resolve) => {
      const t0 = performance.now();
      this.set("speaking");
      const tick = () => {
        if (tok !== this.token) return resolve("stopped");
        const t = (performance.now() - t0) / 1000;
        const p = progressAt(timeline, t);
        this.set(p.activePause !== null ? "pausing" : "speaking", p);
        if (t >= timeline.duration) {
          this.finish(tok, timeline.entries.filter((e) => e.type === "word").length);
          return resolve("done");
        }
        this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    });
  }

  private async speakBrowser(tok: number, script: SpokenScript, req: PerformRequest): Promise<PerformResult> {
    const p = PERSONAS[req.persona];
    const synth = window.speechSynthesis;
    // Wait for the device voice list before choosing, or the pick is made
    // against an empty array and the default voice wins.
    await voicesReady();
    const voice = pickBrowserVoice(req.persona, req.browserVoice);
    this.source = "browser";
    this.set("speaking");
    for (const seg of script.segments) {
      if (tok !== this.token) return "stopped";
      await new Promise<void>((resolve) => {
        const u = new SpeechSynthesisUtterance(seg.text);
        if (voice) {
          u.voice = voice;
          u.lang = voice.lang;
        }
        u.rate = (req.care ? 1 : p.voice.browser.rate) * req.pace;
        u.pitch = req.care ? 1 : p.voice.browser.pitch;
        const starts: number[] = [];
        let off = 0;
        for (const w of seg.text.split(" ")) {
          starts.push(off);
          off += w.length + 1;
        }
        let lit = 0;
        let timer: ReturnType<typeof setInterval> | null = null;
        let done = false;
        const light = (n: number) => {
          const next = Math.min(seg.wordCount, Math.max(lit, n));
          if (next !== lit) {
            lit = next;
            this.set("speaking", { wordsLit: seg.firstWord + lit, activePause: null });
          }
        };
        const finish = () => {
          if (done) return;
          done = true;
          if (timer) clearInterval(timer);
          light(seg.wordCount);
          resolve();
        };
        const perWord = 60000 / (160 * u.rate);
        u.onstart = () => {
          light(1);
          timer = setInterval(() => (tok !== this.token ? finish() : light(lit + 1)), perWord);
        };
        u.onboundary = (e) => {
          if (e.name && e.name !== "word") return;
          let k = 0;
          while (k + 1 < starts.length && starts[k + 1]! <= e.charIndex) k++;
          light(k + 1);
        };
        u.onend = finish;
        u.onerror = finish;
        synth.speak(u);
        setTimeout(() => {
          if (lit === 0) finish();
        }, 5000);
      });
      if (tok !== this.token) return "stopped";
      if (seg.pause) {
        const ms = req.care ? 400 : seg.pause.len === "long" ? p.voice.gaps.long / req.pace : p.voice.gaps.short / req.pace;
        this.set("pausing", { wordsLit: seg.firstWord + seg.wordCount, activePause: seg.pause.pauseIndex });
        await new Promise((r) => setTimeout(r, ms));
        if (tok !== this.token) return "stopped";
        this.set("speaking", { wordsLit: seg.firstWord + seg.wordCount, activePause: null });
      }
    }
    this.finish(tok, script.wordCount);
    return "done";
  }

  private finish(tok: number, words: number) {
    if (tok !== this.token) return;
    cancelAnimationFrame(this.raf);
    this.set("speaking", { wordsLit: words, activePause: null });
    this.performing = false;
    this.currentKey = null;
    this.set("idle");
  }
}

export function browserVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  return window.speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang));
}

/**
 * speechSynthesis.getVoices() is populated asynchronously. On Android it
 * returns an empty list on the first call, so picking a voice synchronously
 * selected nothing and every persona spoke in the device default, which is
 * female. Resolves once the list arrives, or gives up so speech is never
 * blocked on a browser that fires no event.
 */
export function voicesReady(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return resolve([]);
    const ready = browserVoices();
    if (ready.length) return resolve(ready);
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.speechSynthesis.removeEventListener("voiceschanged", finish);
      clearTimeout(timer);
      resolve(browserVoices());
    };
    const timer = setTimeout(finish, timeoutMs);
    window.speechSynthesis.addEventListener("voiceschanged", finish);
    // Some engines only populate the list once getVoices has been called.
    window.speechSynthesis.getVoices();
  });
}

/** Pick the best device voice for a persona (prototype's scoring), unless the user chose one. */
export function pickBrowserVoice(persona: PersonaId, chosen?: string | null): SpeechSynthesisVoice | null {
  const voices = browserVoices();
  if (chosen) {
    const v = voices.find((x) => x.name === chosen);
    if (v) return v;
  }
  const pref = PERSONAS[persona].voice.browser;
  let best: SpeechSynthesisVoice | null = null;
  let bestScore = -1;
  for (const v of voices) {
    const n = v.name.toLowerCase();
    let score = 0;
    const idx = pref.prefs.findIndex((k) => n.includes(k));
    if (idx >= 0) score += 100 - idx * 4;
    if (/natural|online|neural|premium|enhanced/.test(n)) score += 30;
    if (/en[-_]us/i.test(v.lang)) score += 8;
    // Android's Google voices are named like "en-us-x-tpf-local" with no gender
    // word, so name-based detection misses entirely and every voice ties at
    // zero, leaving whatever the device happens to list first. Match the codes.
    const uri = (v.voiceURI || "").toLowerCase();
    const id = `${n} ${uri}`;
    const femaleHit = /female|zira|aria|jenny|ava|samantha|susan|emma|en-us-x-tpf|en-us-x-sfg|en-us-x-iog|en-us-x-tpc|en-gb-x-gba|en-gb-x-gbc/.test(id);
    const maleHit = /\bmale\b|guy|andrew|davis|brian|eric|david|mark|daniel|richard|james|george|william|ravi|christopher|roger|steffan|ryan|en-us-x-iom|en-us-x-iob|en-us-x-tpd|en-gb-x-gbb|en-gb-x-gbd/.test(id);
    if (!pref.female) {
      if (femaleHit) score -= 80;
      if (maleHit) score += 40;
    } else {
      if (maleHit) score -= 80;
      if (femaleHit) score += 40;
    }
    if (score > bestScore) {
      best = v;
      bestScore = score;
    }
  }
  return best;
}

let singleton: Performer | null = null;
export function performer(): Performer {
  singleton ??= new Performer();
  return singleton;
}
export type { Performer };
