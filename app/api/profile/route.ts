import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, readJson, withSession } from "@/lib/api";
import { INTENSITIES } from "@/lib/personas/config";
import { PersonaIdSchema } from "@/lib/consult/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Settings = z
  .object({
    speak: z.boolean(),
    pace: z.number().min(0.8).max(1.2),
    intensity: z.enum(INTENSITIES),
    persona: PersonaIdSchema,
    readPlay: z.boolean(),
    voices: z.record(z.string(), z.string().max(64)),
  })
  .partial();

const Body = z.object({
  settings: Settings.optional(),
  display_name: z.string().trim().max(80).nullable().optional(),
  ageConfirmed: z.literal(true).optional(),
  disclosureAck: z.literal(true).optional(),
  onboarded: z.literal(true).optional(),
});

export const GET = withSession(async (session) => NextResponse.json({ profile: await session.store.getProfile(), user: session.user }));

/** PATCH /api/profile: settings and onboarding acknowledgements (18+, AI disclosure). */
export const PATCH = withSession(async (session, req) => {
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("bad_request", parsed.error.issues[0]?.message ?? "Invalid settings.", 400);
  const profile = await session.store.updateProfile(parsed.data as Parameters<typeof session.store.updateProfile>[0]);
  return NextResponse.json({ profile });
});
