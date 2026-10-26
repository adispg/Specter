"use client";
import { BRAND, PERSONAS, type PersonaId } from "@/lib/personas/config";
import { stripMarks } from "@/lib/spoken";

/**
 * Sharing a reply.
 *
 * Only the line and the principle leave the app. The situation, the read, the
 * plays, the avoid and every follow-up stay private: they name the user's
 * colleagues and describe their week, which is why nobody would forward the
 * full reply. A line plus a principle stands on its own and lets the reader
 * supply their own manager.
 *
 * The card carries the app name only, never a persona's display name. Private
 * use under those names is one thing; a shared image is distribution.
 */

const W = 1080;
const H = 1080;

export type ShareInput = { persona: PersonaId; line: string; principle?: string };

/** The text form, also used as the fallback when there is no share sheet. */
export function buildShareText({ line, principle }: ShareInput): string {
  const l = stripMarks(line).replace(/\s+/g, " ").trim();
  const p = (principle ?? "").replace(/\s+/g, " ").trim();
  return [l, p, BRAND.appName].filter(Boolean).join("\n\n");
}

function family(varName: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return v || fallback;
}

/** Greedy word wrap at a given font, returning the lines that fit maxWidth. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) line = next;
    else {
      out.push(line);
      line = word;
    }
  }
  if (line) out.push(line);
  return out;
}

/**
 * Draw the card. Returns null if canvas is unavailable, so the caller can fall
 * back to text rather than failing the share.
 */
export async function renderShareCard(input: ShareInput): Promise<Blob | null> {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const theme = PERSONAS[input.persona].theme;
    // Wait for the webfonts, or the first render falls back to a system face.
    try {
      await document.fonts.ready;
    } catch {
      // Font loading API unavailable; the stack below still resolves.
    }

    const display = family("--display", "Georgia, serif");
    const sans = family("--sans", "system-ui, sans-serif");

    // Background: the persona's own tint falling away to the app's dark base.
    const bg = ctx.createLinearGradient(0, 0, W * 0.4, H);
    bg.addColorStop(0, theme.avTo);
    bg.addColorStop(0.55, "#0d1119");
    bg.addColorStop(1, "#090c12");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const PAD = 96;
    const maxW = W - PAD * 2;

    // The persona mark: colour and shape only, never a name.
    const markR = 34;
    const markX = PAD + markR;
    const markY = PAD + markR;
    const g = ctx.createRadialGradient(markX - markR * 0.3, markY - markR * 0.4, markR * 0.15, markX, markY, markR);
    g.addColorStop(0, theme.avFrom);
    g.addColorStop(1, theme.avTo);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(markX, markY, markR, 0, Math.PI * 2);
    ctx.fill();

    // The principle, as a quiet eyebrow.
    let y = markY + markR + 86;
    const principle = (input.principle ?? "").replace(/\s+/g, " ").trim();
    if (principle) {
      ctx.font = `600 26px ${sans}`;
      ctx.fillStyle = theme.accent;
      ctx.letterSpacing = "2.4px";
      ctx.fillText(principle.toUpperCase(), PAD, y);
      ctx.letterSpacing = "0px";
      y += 64;
    }

    // The line is the whole point, so it gets the space and shrinks to fit
    // rather than being clipped.
    const text = stripMarks(input.line).replace(/\s+/g, " ").trim();
    let size = 86;
    let lines: string[] = [];
    const bottomLimit = H - PAD - 120;
    for (; size >= 44; size -= 4) {
      ctx.font = `700 ${size}px ${display}`;
      lines = wrap(ctx, text, maxW);
      if (y + lines.length * size * 1.14 <= bottomLimit) break;
    }
    ctx.fillStyle = "#eef1f6";
    ctx.font = `700 ${size}px ${display}`;
    for (const l of lines) {
      y += size;
      ctx.fillText(l, PAD, y);
      y += size * 0.14;
    }

    // Footer: the app, and nothing that identifies a character.
    ctx.font = `700 28px ${sans}`;
    ctx.fillStyle = "#eef1f6";
    ctx.letterSpacing = "6px";
    ctx.fillText(BRAND.wordmark, PAD, H - PAD - 34);
    ctx.letterSpacing = "0px";
    ctx.font = `400 24px ${sans}`;
    ctx.fillStyle = "rgba(238,241,246,0.45)";
    ctx.fillText(BRAND.promise, PAD, H - PAD + 6);

    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  } catch {
    return null;
  }
}

export type ShareOutcome = "shared" | "copied" | "cancelled" | "failed";

/**
 * Share the card. Image through the share sheet where the device allows it,
 * then the share sheet with text, then the clipboard. A cancelled share sheet
 * is reported separately so the caller does not show an error for it.
 */
export async function shareLine(input: ShareInput): Promise<ShareOutcome> {
  const text = buildShareText(input);
  const nav = typeof navigator === "undefined" ? null : navigator;

  if (nav?.share) {
    const blob = await renderShareCard(input);
    if (blob) {
      const file = new File([blob], "specter.png", { type: "image/png" });
      if (!nav.canShare || nav.canShare({ files: [file] })) {
        try {
          await nav.share({ files: [file], text });
          return "shared";
        } catch (e) {
          if ((e as Error)?.name === "AbortError") return "cancelled";
          // Some platforms accept canShare and still reject files; fall through.
        }
      }
    }
    try {
      await nav.share({ text });
      return "shared";
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return "cancelled";
    }
  }

  const { copyText } = await import("@/components/ui");
  return (await copyText(text)) ? "copied" : "failed";
}
