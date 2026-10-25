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

  const [caseData, savedLines, profile] = await Promise.all([
    session.store.getCase(id),
    session.store.listSavedLines(),
    session.store.getProfile(),
  ]);

  if (!caseData) notFound();

  const consults = await session.store.listConsults(id);
  if (!consults.length) notFound();

  const consultIds = consults.map((c) => c.id);
  const feedbackList = await session.store.getFeedback(consultIds);
  const feedback: Record<string, "up" | "down"> = {};
  for (const f of feedbackList) feedback[f.consult_id] = f.rating;

  const savedIds = savedLines.filter((s) => s.case_id === id).map((s) => s.consult_id ?? "");
  const help = helpFor(profile.country);

  return (
    <div className="screen">
      <ResultView
        caseRow={caseData}
        consults={consults}
        savedIds={savedIds}
        feedback={feedback}
        help={help}
        autoSpeak={profile.settings.speak}
      />
    </div>
  );
}
