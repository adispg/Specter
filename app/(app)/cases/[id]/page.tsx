import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { helpFor } from "@/lib/personas/config";
import { ResultView } from "@/components/ResultView";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function CasePage({ params }: Props) {
  const { id } = await params;
  const session = await getSession();
  if (!session) notFound();

  // Fetch in two tiers. First tier: case + saved lines + profile in parallel.
  // Any individual query failure degrades gracefully rather than 500-ing the page.
  // The case itself is the only hard requirement: without it there is nothing to show.
  let caseData, savedLines, profile;
  try {
    [caseData, savedLines, profile] = await Promise.all([
      session.store.getCase(id),
      session.store.listSavedLines().catch(() => []),
      session.store.getProfile().catch(() => null),
    ]);
  } catch (e) {
    console.error(`[case/${id}] failed to load case:`, e instanceof Error ? e.message : e);
    notFound();
  }

  if (!caseData) notFound();

  // Second tier: consults are required to render. Feedback is optional.
  let consults;
  try {
    consults = await session.store.listConsults(id);
  } catch (e) {
    console.error(`[case/${id}] failed to load consults:`, e instanceof Error ? e.message : e);
    notFound();
  }

  if (!consults.length) notFound();

  let feedbackList: Awaited<ReturnType<typeof session.store.getFeedback>>;
  try {
    feedbackList = await session.store.getFeedback(consults.map((c) => c.id));
  } catch {
    feedbackList = [];
  }

  const feedback: Record<string, "up" | "down"> = {};
  for (const f of feedbackList) feedback[f.consult_id] = f.rating;

  const savedIds = (savedLines ?? [])
    .filter((s) => s.case_id === id)
    .map((s) => s.consult_id ?? "");

  const help = helpFor(profile?.country ?? null);

  return (
    <div className="screen">
      <ResultView
        caseRow={caseData}
        consults={consults}
        savedIds={savedIds}
        feedback={feedback}
        help={help}
        autoSpeak={profile?.settings.speak ?? true}
      />
    </div>
  );
}
