import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { publicConfig } from "@/lib/env";
import { AppProvider } from "@/components/AppProvider";
import { AppFrame } from "@/components/AppFrame";
import { KeepCaseSheet } from "@/components/KeepCaseSheet";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/welcome");
  const profile = await session.store.getProfile();
  // 18+ and AI disclosure must be acknowledged before anything else (PRD 6.1).
  if (!profile.age_confirmed_at || !profile.disclosure_ack_at) redirect("/welcome?step=2");
  const user = { isGuest: session.user.isGuest, email: session.user.email, provider: session.user.provider };
  return (
    <AppProvider user={user} config={publicConfig()} initialSettings={profile.settings}>
      <AppFrame>
        {children}
        <KeepCaseSheet />
      </AppFrame>
    </AppProvider>
  );
}
