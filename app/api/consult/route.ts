import { NextResponse } from "next/server";
import { guestKeys, requestCountry } from "@/lib/auth";
import { readJson, withSession } from "@/lib/api";
import { getLlm } from "@/lib/consult/client";
import { parseConsultRequest, runConsult } from "@/lib/consult/service";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/consult
 * Body: { action: "new", persona, intensity, situation }
 *     | { action: "followup", caseId, persona, intensity, text }
 *     | { action: "another" | "switch", caseId, persona, intensity }
 * Returns the persisted, validated consult. 402 when the weekly free tier is spent,
 * 403 guest_limit when a guest must sign in, 429 on the daily cap.
 */
export const POST = withSession(async (session, req) => {
  const request = parseConsultRequest(await readJson(req));
  // getProfile and guestKeys are both independent of each other once we have
  // the session. Run them in parallel to shave one network round-trip off the
  // non-model wall time before runConsultInner starts.
  const [profile, keys] = await Promise.all([
    session.store.getProfile(),
    session.user.isGuest ? guestKeys() : Promise.resolve(null),
  ]);
  const country = profile.country ?? (await requestCountry());
  const result = await runConsult({
    store: session.store,
    llm: getLlm(),
    request,
    plan: profile.plan,
    isGuest: session.user.isGuest,
    country,
    limits: {
      freeConsultsPerWeek: env.freeConsultsPerWeek(),
      freeFollowupsPerCase: env.freeFollowupsPerCase(),
      consultDailyCap: env.consultDailyCap(),
      guestConsults: env.guestConsults(),
      guestPerDevice: env.guestPerDevice(),
      guestPerIp: env.guestPerIp(),
    },
    guest: keys ? { throttle: session.throttle, ...keys } : undefined,
  });
  return NextResponse.json(result);
});
