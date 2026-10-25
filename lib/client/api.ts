"use client";
import type { ConsultRow } from "@/lib/data/types";
import type { ConsultRequest } from "@/lib/consult/schema";
import type { Intensity } from "@/lib/personas/config";

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export async function api<T>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: { ...(json !== undefined ? { "content-type": "application/json" } : {}), ...(rest.headers ?? {}) },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError("offline", "Lost the connection. Your words are saved.", 0);
  }
  if (res.ok) return (await res.json().catch(() => ({}))) as T;
  const body = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } & Record<string, unknown> };
  throw new ApiError(body.error?.code ?? "error", body.error?.message ?? "Something interrupted the call. Try again.", res.status, body.error ?? {});
}

export type ConsultResponse = {
  caseId: string;
  consult: ConsultRow;
  quota: { remaining: number; limit: number; resetAt: string } | null;
  intensityApplied: Intensity;
  downgraded: boolean;
};

export function postConsult(req: ConsultRequest, signal?: AbortSignal): Promise<ConsultResponse> {
  return api<ConsultResponse>("/api/consult", { method: "POST", json: req, signal });
}

/** User-facing copy for consult errors (screens.md, consult result errors). */
export function consultErrorCopy(e: unknown): string {
  if (!(e instanceof ApiError)) return "Something interrupted the call. Try again.";
  switch (e.code) {
    case "invalid_output":
      return "The answer came back garbled. Try again.";
    case "rate_limited":
    case "upstream":
      return "Too many requests right now. Give it a minute.";
    case "refused":
      return "That one won't work as written. Reframe it and try again.";
    case "offline":
      return "Lost the connection. Your words are saved.";
    case "bad_request":
      return e.message;
    default:
      return e.message || "Something interrupted the call. Try again.";
  }
}
