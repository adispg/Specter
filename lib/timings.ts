/**
 * Speech timeline: when each word starts and ends, and when each pause glows.
 * The client lights words by comparing audio.currentTime against this list.
 */
import type { PauseLengths, SpokenScript } from "./spoken";

export type TimelineEntry =
  | { type: "word"; index: number; start: number; end: number }
  | { type: "pause"; index: number; start: number; end: number };

export type Timeline = {
  entries: TimelineEntry[];
  duration: number;
  /** Words matched in the alignment (only set when built from an alignment). */
  matched?: number;
};

export type Alignment = {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
};

/** Rough seconds a word takes at a given pace: base cost plus a per-letter cost. */
export function estimateWordSeconds(word: string, pace = 1): number {
  const letters = word.replace(/[^\p{L}\p{N}]/gu, "").length;
  const punct = /[.!?]$/.test(word) ? 0.18 : /[,;:]$/.test(word) ? 0.08 : 0;
  return (0.12 + letters * 0.055 + punct) / Math.max(0.5, pace);
}

/** Estimated timeline (mock TTS and fallback when no alignment comes back). */
export function estimateTimeline(script: SpokenScript, lengths: PauseLengths, pace = 1): Timeline {
  const entries: TimelineEntry[] = [];
  let t = 0.15;
  for (const seg of script.segments) {
    const words = seg.text.split(" ");
    words.forEach((w, i) => {
      const d = estimateWordSeconds(w, pace);
      entries.push({ type: "word", index: seg.firstWord + i, start: round(t), end: round(t + d) });
      t += d;
    });
    if (seg.pause) {
      const d = seg.pause.len === "long" ? lengths.long : lengths.short;
      entries.push({ type: "pause", index: seg.pause.pauseIndex, start: round(t), end: round(t + d) });
      t += d;
    }
  }
  return { entries, duration: round(t + 0.2) };
}

/**
 * Map character-level alignment back to our words. ElevenLabs returns timing per
 * character of the input (or normalised) text; break tags may or may not appear in
 * it, so words are found by forward search rather than by fixed offsets. Words that
 * cannot be found (number normalisation, for example) are interpolated.
 */
export function timelineFromAlignment(
  script: SpokenScript,
  words: string[],
  alignment: Alignment | null | undefined,
  lengths: PauseLengths,
): Timeline {
  if (!alignment || !alignment.characters?.length) return estimateTimeline(script, lengths);
  const chars = alignment.characters;
  const starts = alignment.character_start_times_seconds;
  const ends = alignment.character_end_times_seconds;
  const hay = chars.join("").toLowerCase();
  // Each character entry is normally one char; build index map in case some entries are longer.
  const posToEntry: number[] = [];
  chars.forEach((c, i) => {
    for (let k = 0; k < c.length; k++) posToEntry.push(i);
  });

  const found: Array<{ start: number; end: number } | null> = [];
  let cursor = 0;
  for (const w of words) {
    const needle = w.toLowerCase();
    const at = hay.indexOf(needle, cursor);
    // Don't jump absurdly far ahead (would desync everything after).
    if (at >= 0 && at - cursor < 80) {
      const a = posToEntry[at] ?? 0;
      const b = posToEntry[at + needle.length - 1] ?? a;
      found.push({ start: starts[a] ?? 0, end: ends[b] ?? starts[a] ?? 0 });
      cursor = at + needle.length;
    } else {
      found.push(null);
    }
  }

  const matched = found.filter(Boolean).length;
  // Interpolate gaps.
  const total = ends[ends.length - 1] ?? 0;
  for (let i = 0; i < found.length; i++) {
    if (found[i]) continue;
    let j = i;
    while (j < found.length && !found[j]) j++;
    const from = i > 0 ? found[i - 1]!.end : 0;
    const to = j < found.length ? found[j]!.start : total;
    const step = (to - from) / (j - i);
    for (let k = i; k < j; k++) found[k] = { start: from + step * (k - i), end: from + step * (k - i + 1) };
    i = j - 1;
  }

  const entries: TimelineEntry[] = [];
  for (const seg of script.segments) {
    for (let i = 0; i < seg.wordCount; i++) {
      const f = found[seg.firstWord + i]!;
      entries.push({ type: "word", index: seg.firstWord + i, start: round(f.start), end: round(f.end) });
    }
    if (seg.pause) {
      const lastWord = found[seg.firstWord + seg.wordCount - 1];
      const nextWord = found[seg.firstWord + seg.wordCount];
      const start = lastWord ? lastWord.end : 0;
      const nominal = seg.pause.len === "long" ? lengths.long : lengths.short;
      const end = nextWord ? Math.max(start + 0.05, nextWord.start) : start + nominal;
      entries.push({ type: "pause", index: seg.pause.pauseIndex, start: round(start), end: round(end) });
    }
  }
  return { entries, duration: round(Math.max(total, entries[entries.length - 1]?.end ?? 0)), matched };
}

/** What should be lit at time t: number of words started, and the active pause if any. */
export function progressAt(timeline: Timeline, t: number): { wordsLit: number; activePause: number | null } {
  let wordsLit = 0;
  let activePause: number | null = null;
  for (const e of timeline.entries) {
    if (e.start > t) break;
    if (e.type === "word") wordsLit = e.index + 1;
    else if (t < e.end) activePause = e.index;
  }
  return { wordsLit, activePause };
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
