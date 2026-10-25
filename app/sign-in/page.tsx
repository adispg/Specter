import Link from "next/link";
import { Suspense } from "react";
import { getSession } from "@/lib/auth";
import { publicConfig } from "@/lib/env";
import { Wordmark } from "@/components/Wordmark";
import { SignInForm } from "@/components/SignInForm";

export const dynamic = "force-dynamic";

export const metadata = { title: "Sign in" };

/**
 * Hosts the existing SignInForm. The component shipped without a page, so the
 * welcome screen's "Sign in" link, the middleware's redirect for returning
 * visitors, sign out, and every auth callback error path all pointed at a 404.
 *
 * A guest who signs in here links their anonymous account rather than starting
 * a new one, which is what keeps the case they already ran.
 */
async function SignInInner({ next }: { next: string }) {
  const session = await getSession();
  const isGuest = Boolean(session?.user.isGuest);

  return (
    <main className="authscr">
      <div className="authbox">
        <Wordmark />

        <div className="authhead">
          <h1 className="t-hero">{isGuest ? "Keep your work." : "Welcome back."}</h1>
          <p className="small">
            {isGuest
              ? "Sign in and the case you just ran stays with your account."
              : "Sign in to pick up your cases and saved lines."}
          </p>
        </div>

        <SignInForm config={publicConfig()} linkGuest={isGuest} next={next} />

        {!session && (
          <p className="fine authfoot">
            New here? <Link href="/welcome">Start without an account</Link>
          </p>
        )}
      </div>
    </main>
  );
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  // Only same-origin paths, so a crafted ?next= cannot bounce someone offsite.
  const raw = sp.next ?? "/";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";

  return (
    <Suspense>
      <SignInInner next={next} />
    </Suspense>
  );
}
