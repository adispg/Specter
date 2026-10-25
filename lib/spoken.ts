/**
 * Pause marks.
 *
 * Generated lines carry "|" (a beat) and "||" (a long, deliberate pause) between
 * phrases. This module turns that text into tokens the UI lights up word by word,
 * segments the browser voice speaks one at a time, and the SSML-style break tags
 * ElevenLabs understands. It is shared by server and client, so it stays pure.
 */
import { scrubDashes, squish } from "./text";

export type PauseLength = "short" | "long";

export type WordToken = { type: "word"; text: string; wordIndex: number };
export type PauseToken = {
  type: "pause";
  len: PauseLength;
  pauseIndex: number;
  /** Implicit pauses (between the line and the follow-up) are timed but not drawn. */
  hidden?: boolean;
};
export type SpokenToken = WordToken | PauseToken;

export type Segment = {
  text: string;
  firstWord: number;
  wordCount: number;
  pause: { len: PauseLength; pauseIndex: number } | null;
};

export type SpokenScript = {
  line: SpokenToken[];
  followup: SpokenToken[];
  segments: Segment[];
  wordCount: number;
  pauseCount: number;
};

export type PauseLengths = { short: number; long: number };

/** Normalise any run of pipes and whitespace to one mark: a single "|" is a beat, anything longer is a long pause. */
function markFor(run: string): PauseLength {
  const pipes = (run.match(/\|/g) ?? []).length;
  return pipes >= 2 ? "long" : "short";
}

type RawPart = { kind: "text"; text: string } | { kind: "pause"; len: PauseLength };

export function splitMarks(text: string): RawPart[] {
  const clean = scrubDashes(text ?? "");
  const parts: RawPart[] = [];
  // Treat separated pipes ("| |") as one run too.
  const re = /\|(?:\s*\|)*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean))) {
    const before = squish(clean.slice(last, m.index));
    if (before) parts.push({ kind: "text", text: before });
    const len = markFor(m[0]);
    const prev = parts[parts.length - 1];
    if (prev && prev.kind === "pause") {
      if (len === "long") prev.len = "long";
    } else if (prev) {
      parts.push({ kind: "pause", len });
    }
    // A mark before any words is dropped.
    last = m.index + m[0].length;
  }
  const tail = squish(clean.slice(last));
  if (tail) parts.push({ kind: "text", text: tail });
  return parts;
}

/**
 * Parse line and follow-up into one script with global word and pause indexes.
 * A long pause separates the line from the follow-up, as in the prototype; it is
 * hidden unless the model already wrote one at the end of the line.
 */
export function parseSpoken(line: string, followup = ""): SpokenScript {
  let wordIndex = 0;
  let pauseIndex = 0;
  const segments: Segment[] = [];

  const build = (text: string): SpokenToken[] => {
    const tokens: SpokenToken[] = [];
    for (const part of splitMarks(text)) {
      if (part.kind === "pause") {
        const t: PauseToken = { type: "pause", len: part.len, pauseIndex: pauseIndex++ };
        tokens.push(t);
        const seg = segments[segments.length - 1];
        if (seg) seg.pause = { len: t.len, pauseIndex: t.pauseIndex };
        continue;
      }
      const words = part.text.split(" ").filter(Boolean);
      segments.push({ text: words.join(" "), firstWord: wordIndex, wordCount: words.length, pause: null });
      for (const w of words) tokens.push({ type: "word", text: w, wordIndex: wordIndex++ });
    }
    return tokens;
  };

  const lineTokens = build(line);
  // Separator between line and follow-up.
  const hasFollow = splitMarks(followup).some((p) => p.kind === "text");
  const lastLineSeg = segments[segments.length - 1];
  if (hasFollow && lastLineSeg && !lastLineSeg.pause) {
    const t: PauseToken = { type: "pause", len: "long", pauseIndex: pauseIndex++, hidden: true };
    lineTokens.push(t);
    lastLineSeg.pause = { len: "long", pauseIndex: t.pauseIndex };
  }
  const followTokens = build(followup);
  // A trailing pause at the very end has nothing to separate: keep it drawn, but don't time it.
  const lastSeg = segments[segments.length - 1];
  if (lastSeg?.pause) {
    const trailing = lastSeg.pause;
    lastSeg.pause = null;
    for (const arr of [followTokens, lineTokens]) {
      const tok = arr.find((t) => t.type === "pause" && t.pauseIndex === trailing.pauseIndex);
      if (tok && tok.type === "pause") {
        if (tok.hidden) arr.splice(arr.indexOf(tok), 1);
        break;
      }
    }
  }

  return { line: lineTokens, followup: followTokens, segments, wordCount: wordIndex, pauseCount: pauseIndex };
}

/** Remove pause marks for copying, sharing and plain display. */
export function stripMarks(text: string): string {
  return squish(scrubDashes(text ?? "").replace(/\s*\|+\s*/g, " "));
}

export function countMarks(text: string): { short: number; long: number } {
  let short = 0;
  let long = 0;
  for (const p of splitMarks(text)) {
    if (p.kind === "pause") {
      if (p.len === "long") long++;
      else short++;
    }
  }
  return { short, long };
}

function fmtSeconds(s: number): string {
  const v = Math.max(0.05, Math.min(3, s));
  return `${Number(v.toFixed(2))}s`;
}

export function breakTag(len: PauseLength, lengths: PauseLengths): string {
  return `<break time="${fmtSeconds(len === "long" ? lengths.long : lengths.short)}" />`;
}

/**
 * Text for ElevenLabs: words joined by spaces, pause marks replaced by break tags,
 * e.g. `They didn't lowball you. <break time="1.1s" /> They asked a question.`
 * Also returns where each word starts in that text so timestamps can be mapped back.
 */
export function toElevenLabsText(
  script: SpokenScript,
  lengths: PauseLengths,
): { text: string; wordOffsets: number[]; words: string[] } {
  let text = "";
  const wordOffsets: number[] = [];
  const words: string[] = [];
  for (const seg of script.segments) {
    for (const w of seg.text.split(" ")) {
      if (text) text += " ";
      wordOffsets.push(text.length);
      words.push(w);
      text += w;
    }
    if (seg.pause) text += " " + breakTag(seg.pause.len, lengths);
  }
  return { text, wordOffsets, words };
}

/** Convenience for a single string with marks (used by tests and the harness). */
export function marksToBreaks(text: string, lengths: PauseLengths): string {
  return toElevenLabsText(parseSpoken(text), lengths).text;
}
