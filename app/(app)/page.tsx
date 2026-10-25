"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { personaPlaceholder, useApp } from "@/components/AppProvider";
import { TabBar, PersonaRail, Composer, IntensityControl, OfflineBanner, ErrorBanner } from "@/components/ui";
import { useConsult } from "@/lib/client/useConsult";

export default function HomePage() {
  const { persona, setPersona, settings } = useApp();
  const [text, setText] = useState("");
  const consult = useConsult();
  const router = useRouter();

  async function submit() {
    if (!text.trim()) return;
    const res = await consult.run({
      action: "new",
      persona,
      intensity: settings.intensity,
      situation: text.trim(),
    });
    if (res) {
      setText("");
      router.push(`/cases/${res.caseId}`);
    }
  }

  return (
    <div className="screen">
      <header className="screen-header">
        <PersonaRail value={persona} onChange={setPersona} />
        <IntensityControl />
      </header>

      <main className="screen-main">
        <OfflineBanner />
        {consult.error && (
          <ErrorBanner onRetry={consult.retry}>{consult.error}</ErrorBanner>
        )}
        <div className="home-prompt">
          <p className="home-prompt-text">
            Bring the situation. Leave with the line.
          </p>
        </div>
      </main>

      <Composer
        value={text}
        onChange={setText}
        onSubmit={submit}
        placeholder={personaPlaceholder(persona, false)}
        busy={consult.busy}
        onStop={consult.stop}
        autoFocus
      />

      <TabBar />
    </div>
  );
}
