"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { PublicConfig } from "@/lib/env";
import type { UserSettings } from "@/lib/data/types";
import { PERSONAS, isPersonaId, type Intensity, type PersonaId } from "@/lib/personas/config";
import { IconCheck } from "./Icons";

export type ClientUser = { isGuest: boolean; email: string | null; provider: string | null };

type Toast = { id: number; msg: string; action?: { label: string; run: () => void }; ok?: boolean };

type Ctx = {
  user: ClientUser;
  config: PublicConfig;
  settings: UserSettings;
  updateSettings: (patch: Partial<UserSettings>) => void;
  persona: PersonaId;
  setPersona: (p: PersonaId) => void;
  setIntensity: (i: Intensity) => void;
  browserVoice: (p: PersonaId) => string | null;
  setBrowserVoice: (p: PersonaId, name: string | null) => void;
  toast: (msg: string, opts?: { action?: Toast["action"]; ok?: boolean; ms?: number }) => void;
  online: boolean;
  /** "Keep this case?" sheet for guests. `forced` hides "Not now" (second consult). */
  keepCase: { open: boolean; forced: boolean };
  openKeepCase: (forced?: boolean) => void;
  closeKeepCase: () => void;
};

const AppCtx = createContext<Ctx | null>(null);

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside AppProvider");
  return c;
}

function readLocal<T>(k: string, d: T): T {
  try {
    const v = localStorage.getItem(`specter.${k}`);
    return v == null ? d : (JSON.parse(v) as T);
  } catch {
    return d;
  }
}
function writeLocal(k: string, v: unknown) {
  try {
    localStorage.setItem(`specter.${k}`, JSON.stringify(v));
  } catch {
    // Private mode or storage blocked: settings still sync to the profile.
  }
}

export function AppProvider({
  user,
  config,
  initialSettings,
  children,
}: {
  user: ClientUser;
  config: PublicConfig;
  initialSettings: UserSettings;
  children: ReactNode;
}) {
  const [settings, setSettings] = useState<UserSettings>(initialSettings);
  const [persona, setPersonaState] = useState<PersonaId>(isPersonaId(initialSettings.persona) ? initialSettings.persona : "closer");
  const [voices, setVoices] = useState<Partial<Record<PersonaId, string>>>({});
  const [toastState, setToast] = useState<Toast | null>(null);
  const [online, setOnline] = useState(true);
  const [keepCase, setKeepCase] = useState({ open: false, forced: false });
  const pending = useRef<Partial<UserSettings>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setVoices(readLocal("browserVoices", {}));
    const on = () => setOnline(navigator.onLine);
    on();
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
    };
  }, []);

  const toast = useCallback<Ctx["toast"]>((msg, opts = {}) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), msg, action: opts.action, ok: opts.ok });
    toastTimer.current = setTimeout(() => setToast(null), opts.ms ?? (opts.action ? 4000 : 2600));
  }, []);

  const flush = useCallback(async () => {
    const patch = pending.current;
    pending.current = {};
    if (Object.keys(patch).length === 0) return;
    try {
      const res = await fetch("/api/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ settings: patch }) });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      pending.current = { ...patch, ...pending.current };
      toast("Couldn't save that. We'll keep trying.");
      timer.current = setTimeout(flush, 5000);
    }
  }, [toast]);

  const updateSettings = useCallback(
    (patch: Partial<UserSettings>) => {
      setSettings((s) => ({ ...s, ...patch }));
      pending.current = { ...pending.current, ...patch };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, 400);
    },
    [flush],
  );

  const setPersona = useCallback(
    (p: PersonaId) => {
      setPersonaState(p);
      updateSettings({ persona: p });
    },
    [updateSettings],
  );

  const setIntensity = useCallback((i: Intensity) => updateSettings({ intensity: i }), [updateSettings]);

  const value = useMemo<Ctx>(
    () => ({
      user,
      config,
      settings,
      updateSettings,
      persona,
      setPersona,
      setIntensity,
      browserVoice: (p) => voices[p] ?? null,
      setBrowserVoice: (p, name) =>
        setVoices((v) => {
          const next = { ...v, [p]: name ?? undefined };
          writeLocal("browserVoices", next);
          return next;
        }),
      toast,
      online,
      keepCase,
      openKeepCase: (forced = false) => setKeepCase({ open: true, forced }),
      closeKeepCase: () => setKeepCase({ open: false, forced: false }),
    }),
    [user, config, settings, updateSettings, persona, setPersona, setIntensity, voices, toast, online, keepCase],
  );

  return (
    <AppCtx.Provider value={value}>
      {children}
      {toastState && (
        <div className="toast" role="status" key={toastState.id} data-testid="toast">
          {toastState.ok && <IconCheck />}
          <span>{toastState.msg}</span>
          {toastState.action && (
            <button
              type="button"
              onClick={() => {
                toastState.action?.run();
                setToast(null);
              }}
            >
              {toastState.action.label}
            </button>
          )}
        </div>
      )}
    </AppCtx.Provider>
  );
}

export function personaPlaceholder(p: PersonaId, hasCase: boolean): string {
  const s = PERSONAS[p].short;
  return hasCase ? `Push back, or tell ${s} what happened next` : `Tell ${s} what's going on`;
}
