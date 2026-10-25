"use client";
import { useState } from "react";
import { api } from "@/lib/client/api";
import { useApp } from "./AppProvider";
import { IconThumbDown, IconThumbUp } from "./Icons";
import { Sheet } from "./ui";

// ---------------------------------------------------------------- when is it happening

function at(hour: number, addDays: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + addDays);
  d.setHours(hour, 0, 0, 0);
  return d;
}

/** "When is it happening?" (design review B6): sets moment_at for the debrief later. */
export function MomentRow({ caseId, momentAt, onChange }: { caseId: string; momentAt: string | null; onChange?: (iso: string | null) => void }) {
  const { toast } = useApp();
  const [value, setValue] = useState<string | null>(momentAt);
  const [picking, setPicking] = useState(false);
  const [custom, setCustom] = useState("");

  async function save(d: Date | null) {
    const iso = d ? d.toISOString() : null;
    setValue(iso);
    onChange?.(iso);
    try {
      await api(`/api/cases/${caseId}`, { method: "PATCH", json: { moment_at: iso } });
      if (d) toast(`Got it. We'll ask how it went after ${d.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}.`, { ok: true });
    } catch {
      toast("Couldn't save that. Try again.");
    }
  }

  const now = new Date();
  const todayEvening = now.getHours() < 18 ? at(18, 0) : new Date(now.getTime() + 3 * 3600_000);
  const options: Array<{ label: string; d: Date }> = [
    { label: "Today", d: todayEvening },
    { label: "Tomorrow", d: at(18, 1) },
    { label: "This week", d: at(18, Math.max(1, 5 - ((now.getDay() + 6) % 7))) },
  ];

  if (value) {
    return (
      <div className="srow" style={{ padding: "4px 0", minHeight: 40 }} data-testid="moment-set">
        <span className="small grow">
          Happening {new Date(value).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
        </span>
        <button type="button" className="textbtn" onClick={() => save(null)}>
          Clear
        </button>
      </div>
    );
  }
  return (
    <div className="stack" style={{ gap: 8 }} data-testid="moment-row">
      <p className="label">When is it happening?</p>
      <div className="chips wrap">
        {options.map((o) => (
          <button key={o.label} type="button" className="chip" onClick={() => save(o.d)}>
            {o.label}
          </button>
        ))}
        <button type="button" className="chip" onClick={() => setPicking(true)}>
          Pick a time
        </button>
      </div>
      <Sheet open={picking} onClose={() => setPicking(false)} title="When is it happening?">
        <div className="field">
          <label htmlFor="moment">Date and time</label>
          <input id="moment" className="input" type="datetime-local" value={custom} onChange={(e) => setCustom(e.target.value)} />
        </div>
        <button
          type="button"
          className="btn primary"
          disabled={!custom}
          onClick={() => {
            setPicking(false);
            void save(new Date(custom));
          }}
        >
          Save
        </button>
      </Sheet>
    </div>
  );
}

// ---------------------------------------------------------------- feedback

const REASONS: Array<{ id: "too_long" | "off_target" | "not_their_voice" | "unsafe" | "other"; label: string }> = [
  { id: "too_long", label: "Too long" },
  { id: "off_target", label: "Off target" },
  { id: "not_their_voice", label: "Not their voice" },
  { id: "unsafe", label: "Unsafe" },
  { id: "other", label: "Other" },
];

/** "Was this useful?" with thumbs and an optional reason (design review B8). */
export function FeedbackRow({ consultId, initial }: { consultId: string; initial: "up" | "down" | null }) {
  const { toast } = useApp();
  const [rating, setRating] = useState<"up" | "down" | null>(initial);
  const [sheet, setSheet] = useState(false);

  async function send(r: "up" | "down", reason: string | null = null) {
    setRating(r);
    try {
      await api("/api/feedback", { method: "POST", json: { consultId, rating: r, reason } });
      toast("Thanks. That helps.", { ok: true });
    } catch {
      toast("Couldn't send that. Try again.");
    }
  }

  return (
    <div className="srow" style={{ padding: "4px 0", minHeight: 44 }} data-testid="feedback">
      <span className="small grow">Was this useful?</span>
      <button type="button" className="ib" aria-pressed={rating === "up"} aria-label="Useful" onClick={() => send("up")} style={rating === "up" ? { color: "var(--accent)", borderColor: "var(--accent)" } : undefined}>
        <IconThumbUp />
      </button>
      <button
        type="button"
        className="ib"
        aria-pressed={rating === "down"}
        aria-label="Not useful"
        onClick={() => setSheet(true)}
        style={rating === "down" ? { color: "var(--accent)", borderColor: "var(--accent)" } : undefined}
      >
        <IconThumbDown />
      </button>
      <Sheet open={sheet} onClose={() => setSheet(false)} title="What missed?">
        <div className="chips wrap">
          {REASONS.map((r) => (
            <button
              key={r.id}
              type="button"
              className="chip"
              onClick={() => {
                setSheet(false);
                void send("down", r.id);
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            setSheet(false);
            void send("down");
          }}
        >
          Skip
        </button>
      </Sheet>
    </div>
  );
}
