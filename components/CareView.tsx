"use client";
import { useEffect, useRef } from "react";
import { BRAND, CRISIS_DIRECTORY_URL, type RegionHelp } from "@/lib/personas/config";
import type { ConsultRow } from "@/lib/data/types";
import { usePerformance } from "@/lib/client/usePerformance";
import { useApp } from "./AppProvider";
import { PersonaTheme } from "./Persona";
import { IconHeart, IconPhone } from "./Icons";

/**
 * Care mode (PRD 6.11, design review B5): the persona is gone. Neutral tint, no
 * avatar, no billing, no intensity, no pause marks. Named local helpline with
 * one-tap calling, the local emergency number, then the directory.
 */
export function CareView({ consult, help, autoSpeak }: { consult: ConsultRow; help: RegionHelp; autoSpeak: boolean }) {
  const { settings, config } = useApp();
  const perf = usePerformance(`care:${consult.id}`);
  const started = useRef(false);
  const r = consult.reply;

  useEffect(() => {
    if (!autoSpeak || !settings.speak || started.current) return;
    started.current = true;
    void perf.play({
      persona: consult.persona,
      line: r.line,
      followup: r.followup,
      care: true,
      pace: 1,
      tts: config.ttsEnabled ? { consultId: consult.id } : null,
    });
    return () => perf.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSpeak]);

  const primary = help.lines[0];
  return (
    <PersonaTheme persona="neutral" className="stack" style={{ gap: 16 }}>
      <div data-testid="care-view" className="stack" style={{ gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="ib" style={{ width: 46, height: 46, color: "var(--accent)" }} aria-hidden="true">
            <IconHeart style={{ width: 20, height: 20 }} />
          </span>
          <h1 className="t2">Let&apos;s pause the advice for a moment.</h1>
        </div>
        <article className="take" style={{ gap: 12 }}>
          <p className="follow" style={{ color: "var(--fg)" }} data-testid="care-message">
            {r.line}
          </p>
          {r.followup && <p className="follow">{r.followup}</p>}
        </article>
        <div className="card" style={{ borderColor: "color-mix(in srgb, var(--accent) 30%, transparent)", display: "grid", gap: 10 }}>
          <p style={{ fontSize: 14.5 }}>If you&apos;re in danger or thinking about hurting yourself, contact local emergency services now.</p>
          {primary && (
            <a className="btn primary" href={primary.tel} data-testid="helpline">
              <IconPhone />
              Call {primary.name}, {primary.number}
            </a>
          )}
          {help.lines.slice(1).map((l) => (
            <a key={l.tel} className="btn secondary" href={l.tel}>
              Call {l.name}, {l.number}
            </a>
          ))}
          <a className="btn secondary" href={help.emergency.tel}>
            Call emergency services{/^\d/.test(help.emergency.number) ? `, ${help.emergency.number}` : ""}
          </a>
          <a className="textbtn" href={CRISIS_DIRECTORY_URL} target="_blank" rel="noreferrer" style={{ justifySelf: "center" }}>
            Other countries
          </a>
        </div>
        {r.play.length > 0 && (
          <div className="card">
            <h3>Right now</h3>
            <ol>
              {r.play.slice(0, 3).map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </div>
        )}
        <p className="fine">{BRAND.appName} is not a substitute for professional help. When you&apos;re ready, the personas will be here.</p>
      </div>
    </PersonaTheme>
  );
}
