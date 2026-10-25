"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { INTENSITIES, INTENSITY_LABELS, PERSONAS, personaList, type Intensity, type PersonaId } from "@/lib/personas/config";
import type { Reply } from "@/lib/consult/schema";
import { useApp } from "./AppProvider";
import { Avatar } from "./Persona";
import { IconAlert, IconBookmark, IconCase, IconConsult, IconDial, IconMic, IconSend, IconStop, IconWifiOff } from "./Icons";

// ---------------------------------------------------------------- tab bar

const TABS = [
  { href: "/", label: "Consult", icon: IconConsult, match: (p: string) => p === "/" || p.startsWith("/consult") },
  { href: "/cases", label: "Cases", icon: IconCase, match: (p: string) => p.startsWith("/cases") },
  { href: "/saved", label: "Saved", icon: IconBookmark, match: (p: string) => p.startsWith("/saved") },
];

export function TabBar() {
  const path = usePathname() ?? "/";
  return (
    <nav className="tabs" aria-label="Main">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className="tab" aria-current={t.match(path) ? "page" : undefined} data-testid={`tab-${t.label.toLowerCase()}`}>
          <t.icon />
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

// ---------------------------------------------------------------- banners

export function OfflineBanner() {
  const { online } = useApp();
  if (online) return null;
  return (
    <div className="banner warn" role="status" style={{ margin: "0 var(--gutter-r) 8px var(--gutter-l)" }}>
      <IconWifiOff />
      <span>You&apos;re offline. Past cases and saved lines still work.</span>
    </div>
  );
}

export function ErrorBanner({ children, onRetry, retryLabel = "Retry" }: { children: ReactNode; onRetry?: () => void; retryLabel?: string }) {
  return (
    <div className="banner danger" role="alert" data-testid="error-banner">
      <IconAlert />
      <span>{children}</span>
      {onRetry && (
        <button type="button" className="act" onClick={onRetry}>
          {retryLabel}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- sheet

export function Sheet({ open, onClose, title, children, label, testId }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; label?: string; testId?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    const el = ref.current;
    const focusables = () => Array.from(el?.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea, [tabindex]:not([tabindex='-1'])") ?? []);
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const f = focusables();
        if (f.length === 0) return;
        const first = f[0]!;
        const last = f[f.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="scrim" onClick={onClose} aria-hidden="true" />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label ?? title} ref={ref} data-testid={testId}>
        <div className="grab" aria-hidden="true" />
        {title && <h2 className="t2">{title}</h2>}
        {children}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- persona rail

export function PersonaRail({ value, onChange, answered }: { value: PersonaId; onChange: (p: PersonaId) => void; answered?: PersonaId[] }) {
  return (
    <nav className="rail" role="tablist" aria-label="Who you're talking to">
      {personaList().map((p) => (
        <button
          key={p.id}
          type="button"
          role="tab"
          className="who"
          aria-selected={value === p.id}
          onClick={() => value !== p.id && onChange(p.id)}
          data-testid={`rail-${p.id}`}
          aria-label={answered && !answered.includes(p.id) ? `${p.short}, not asked yet` : p.short}
        >
          <Avatar persona={p.id} size="lg" />
          <span>{p.short}</span>
        </button>
      ))}
    </nav>
  );
}

// ---------------------------------------------------------------- intensity

export const INTENSITY_HINTS: Record<Intensity, string> = {
  measured: "Direct, warmer underneath.",
  sharp: "The full character.",
  nomercy: "The hard truth, no cushioning.",
};

/** Intensity is a setting, never part of a persona's name (design-system.md 6.16). */
export function IntensityControl() {
  const { settings, setIntensity, toast } = useApp();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="intensity"
        aria-label={`Intensity: ${INTENSITY_LABELS[settings.intensity]}. Tap to change.`}
        onClick={() => setOpen(true)}
        data-testid="intensity"
      >
        <IconDial />
        Intensity: <b>{INTENSITY_LABELS[settings.intensity]}</b>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Intensity">
        <div className="group" role="radiogroup" aria-label="Intensity">
          {INTENSITIES.map((i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={settings.intensity === i}
              className="srow"
              onClick={() => {
                setIntensity(i);
                setOpen(false);
                toast(`Intensity: ${INTENSITY_LABELS[i]}`, { ms: 1400 });
              }}
            >
              <span className="grow">
                <b style={{ fontWeight: 600 }}>{INTENSITY_LABELS[i]}</b>
                <span className="small" style={{ display: "block" }}>
                  {INTENSITY_HINTS[i]}
                </span>
              </span>
              {settings.intensity === i && <span className="val">Selected</span>}
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}

export function IntensitySegmented() {
  const { settings, setIntensity } = useApp();
  return (
    <div className="seg" role="group" aria-label="Intensity">
      {INTENSITIES.map((i) => (
        <button key={i} type="button" aria-pressed={settings.intensity === i} onClick={() => setIntensity(i)} data-testid={`intensity-${i}`}>
          {INTENSITY_LABELS[i]}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- advice cards

export function AdviceCards({
  persona,
  reply,
  onPick,
}: {
  persona: PersonaId;
  reply: Reply;
  /** clarify mode: tapping a question puts it in the composer. */
  onPick?: (text: string) => void;
}) {
  const p = PERSONAS[persona];

  // A capability question or a greeting gets an answer, not a case file. The
  // line already carries it, so everything below would be padding.
  if (reply.mode === "meta") {
    if (!reply.play.length) return null;
    return (
      <section className="stack" data-testid="advice-cards">
        <div className="card">
          <h3>What to bring me</h3>
          <ul>
            {reply.play.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  // clarify: play holds what the persona needs to know, not moves to make.
  if (reply.mode === "clarify") {
    return (
      <section className="stack" data-testid="advice-cards">
        {reply.read && (
          <div className="card">
            <h3>{p.labels.read}</h3>
            <p>{reply.read}</p>
          </div>
        )}
        <div className="card">
          <h3>What I need</h3>
          <ul>
            {reply.play.map((m, i) => (
              <li key={i}>
                {onPick ? (
                  <button type="button" className="askback" onClick={() => onPick(m)}>
                    {m}
                  </button>
                ) : (
                  m
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  return (
    <section className="stack" data-testid="advice-cards">
      <div className="card">
        <h3>{p.labels.read}</h3>
        <p>{reply.read}</p>
      </div>
      {reply.play.length > 0 && (
        <div className="card">
          <h3>{p.labels.play}</h3>
          <ol>
            {reply.play.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ol>
        </div>
      )}
      {reply.avoid && (
        <div className="card avoid">
          <h3>{p.labels.avoid}</h3>
          <p>{reply.avoid}</p>
        </div>
      )}
    </section>
  );
}

export function SkeletonCards({ n = 2 }: { n?: number }) {
  return (
    <div className="stack" aria-hidden="true">
      {Array.from({ length: n }).map((_, i) => (
        <div className="card" key={i}>
          <div className="sk" style={{ width: 90, height: 10, marginBottom: 12 }} />
          <div className="sk" style={{ height: 12, marginBottom: 8 }} />
          <div className="sk" style={{ height: 12, width: "70%" }} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonRows({ n = 3 }: { n?: number }) {
  return (
    <div className="group" aria-hidden="true">
      {Array.from({ length: n }).map((_, i) => (
        <div className="lrow" key={i}>
          <span className="sk" style={{ width: 36, height: 36, borderRadius: "50%" }} />
          <div className="tx">
            <div className="sk" style={{ height: 12, width: "60%", marginBottom: 8 }} />
            <div className="sk" style={{ height: 12, width: "85%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- composer

export function Composer({
  value,
  onChange,
  onSubmit,
  onMic,
  placeholder,
  busy,
  onStop,
  listening,
  disabled,
  leading,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onMic?: () => void;
  placeholder: string;
  busy?: boolean;
  onStop?: () => void;
  listening?: boolean;
  disabled?: boolean;
  leading?: ReactNode;
  autoFocus?: boolean;
}) {
  const { online } = useApp();
  const ta = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const t = ta.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = `${Math.min(t.scrollHeight, 120)}px`;
  }, [value]);
  useEffect(() => {
    if (autoFocus) ta.current?.focus();
  }, [autoFocus]);
  const canSend = online && !busy && !disabled && value.trim().length > 0;
  return (
    <div className="dock">
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSend) onSubmit();
        }}
      >
        {leading}
        {onMic != null && (
          <button type="button" className="mic" aria-pressed={listening ? "true" : "false"} aria-label={listening ? "Finish speaking" : "Speak instead"} onClick={onMic} disabled={!online}>
            <IconMic />
          </button>
        )}
        <textarea
          ref={ta}
          rows={1}
          value={value}
          readOnly={busy}
          onChange={(e) => onChange(e.target.value)}
          placeholder={online ? placeholder : "You're offline. Type now, send when you're back."}
          aria-label="Your situation"
          data-testid="composer-input"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !matchMedia("(pointer: coarse)").matches) {
              e.preventDefault();
              if (canSend) onSubmit();
            }
          }}
        />
        {busy && onStop ? (
          <button type="button" className="send" aria-label="Stop" onClick={onStop}>
            <IconStop />
          </button>
        ) : (
          <button type="submit" className="send" aria-label="Send" disabled={!canSend} data-testid="send">
            <IconSend />
          </button>
        )}
      </form>
      {listening && <p className="listening-note">Listening. Tap the mic to finish.</p>}
    </div>
  );
}

// ---------------------------------------------------------------- helpers

export function useThinkingLine(persona: PersonaId, active: boolean): string {
  const lines = PERSONAS[persona].thinking;
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(0);
    if (!active || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((x) => (x + 1) % lines.length), 2400);
    return () => clearInterval(t);
  }, [active, lines.length, persona]);
  return lines[i] ?? lines[0]!;
}

export function relTime(iso: string, now = Date.now()): string {
  const d = new Date(iso).getTime();
  const s = Math.max(0, Math.round((now - d) / 1000));
  if (s < 60) return "now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.round(h / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function useRelTime(iso: string): string {
  const [txt, setTxt] = useState("");
  useEffect(() => setTxt(relTime(iso)), [iso]);
  return txt;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
