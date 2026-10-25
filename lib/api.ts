import "server-only";
import { NextResponse } from "next/server";
import { getSession, type Session } from "@/lib/auth";
import { ConsultError } from "@/lib/consult/engine";
import { LlmError } from "@/lib/consult/llm";
import { TtsError } from "@/lib/tts/speech";

export function jsonError(code: string, message: string, status: number, headers: Record<string, string> = {}, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status, headers });
}

/** Wrap a route handler: require a session (guests included unless `fullAccount`) and map known errors to JSON. */
export function withSession<Args extends unknown[]>(
  handler: (session: Session, req: Request, ...args: Args) => Promise<Response>,
  opts: { fullAccount?: boolean } = {},
) {
  return async (req: Request, ...args: Args): Promise<Response> => {
    try {
      const session = await getSession();
      if (!session) return jsonError("unauthorized", "Sign in to continue.", 401);
      if (opts.fullAccount && session.user.isGuest) return jsonError("sign_in_required", "Sign in to do that.", 403);
      return await handler(session, req, ...args);
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export function errorResponse(e: unknown): Response {
  if (e instanceof ConsultError) {
    const headers: Record<string, string> = {};
    if (typeof e.extra.retryAfter === "number") headers["Retry-After"] = String(e.extra.retryAfter);
    const { detail: _detail, ...extra } = e.extra;
    return jsonError(e.code, e.message, e.status, headers, extra);
  }
  if (e instanceof LlmError) {
    // The model error never carries situation text, only provider detail such as
    // a retired model id or a rejected key. Log it: without this the real cause
    // is invisible and every failure looks like a rate limit.
    console.error(`[api] llm error (${e.code}${e.status ? ` ${e.status}` : ""}): ${e.message}`);
    const detail = e.message.slice(0, 300);
    if (e.code === "not_configured")
      return jsonError("not_configured", "The advice engine is not configured.", 503, {}, { detail });
    if (e.code === "refused") return jsonError("refused", "That one won't work as written. Reframe it and try again.", 422);
    if (e.code === "timeout") return jsonError("timeout", "That took too long. Try again.", 504);
    if (e.code === "overloaded")
      return jsonError("overloaded", "Too many requests right now. Give it a minute.", 429, {}, { detail });
    return jsonError("upstream", "The advice engine had a problem. Try again.", 502, {}, { detail });
  }
  if (e instanceof TtsError) return jsonError("tts_failed", "Voice unavailable. Here it is in writing.", e.status);
  // Never log situation text; the error message is enough.
  console.error("[api] unhandled error:", e instanceof Error ? e.message : "unknown");
  return jsonError("internal", "Something interrupted the call. Try again.", 500);
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ConsultError("bad_request", "Request body must be JSON.", 400);
  }
}
