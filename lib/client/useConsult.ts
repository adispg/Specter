"use client";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import type { ConsultRequest } from "@/lib/consult/schema";
import { useApp } from "@/components/AppProvider";
import { ApiError, consultErrorCopy, postConsult, type ConsultResponse } from "./api";

export type ConsultRun = {
  busy: boolean;
  error: string | null;
  lastRequest: ConsultRequest | null;
  run: (req: ConsultRequest) => Promise<ConsultResponse | null>;
  retry: () => Promise<ConsultResponse | null>;
  stop: () => void;
  clearError: () => void;
};

/**
 * Runs a consult and handles the outcomes every screen shares: the weekly limit
 * (402, limit screen), the guest limit (sign-in sheet), a "two left" toast, and
 * inline errors that keep the user's words.
 */
export function useConsult(): ConsultRun {
  const router = useRouter();
  const { openKeepCase, toast } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRequest, setLast] = useState<ConsultRequest | null>(null);
  const ctl = useRef<AbortController | null>(null);

  const run = useCallback(
    async (req: ConsultRequest) => {
      ctl.current?.abort();
      const c = new AbortController();
      ctl.current = c;
      setLast(req);
      setBusy(true);
      setError(null);
      try {
        const res = await postConsult(req, c.signal);
        if (res.quota && res.quota.remaining === 1) toast("One free consult left this week.");
        if (res.downgraded) toast("Intensity eased to Measured for this one.");
        return res;
      } catch (e) {
        if ((e as Error).name === "AbortError" || c.signal.aborted) {
          setError(null);
          return null;
        }
        if (e instanceof ApiError && e.code === "quota_exceeded") {
          router.push("/limit");
          return null;
        }
        if (e instanceof ApiError && e.code === "guest_limit") {
          openKeepCase(true);
          return null;
        }
        if (e instanceof ApiError && e.status === 401) {
          router.push("/sign-in");
          return null;
        }
        setError(consultErrorCopy(e));
        return null;
      } finally {
        if (ctl.current === c) {
          ctl.current = null;
          setBusy(false);
        }
      }
    },
    [router, openKeepCase, toast],
  );

  const retry = useCallback(() => (lastRequest ? run(lastRequest) : Promise.resolve(null)), [lastRequest, run]);
  const stop = useCallback(() => {
    ctl.current?.abort();
    ctl.current = null;
    setBusy(false);
  }, []);

  return { busy, error, lastRequest, run, retry, stop, clearError: () => setError(null) };
}
