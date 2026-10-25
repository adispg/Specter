"use client";
/**
 * A consult the next screen should run on arrival (design review B9: every
 * follow-up, push back, other take or other persona appends to the case thread,
 * and the app navigates there with the new reply performing at the bottom).
 * In memory only: a reload simply shows the thread.
 */
import type { ConsultRequest } from "@/lib/consult/schema";

type Pending = { request: ConsultRequest; speak: boolean; spokenText?: string };
let pending: Pending | null = null;

export function setPending(p: Pending) {
  pending = p;
}

export function takePending(caseId?: string): Pending | null {
  const p = pending;
  if (!p) return null;
  if (caseId && (p.request.action === "new" || p.request.caseId !== caseId)) return null;
  pending = null;
  return p;
}

export function peekPendingNew(): Pending | null {
  return pending && pending.request.action === "new" ? pending : null;
}
