"use client";
import { useEffect } from "react";

/**
 * Error boundary for the signed-in screens.
 *
 * Without this, a server-side exception on any of them renders Next's default
 * error page: a bare "Application error" with a digest and no way back. /cases
 * is one of the three tab bar destinations, so that was a dead end reachable in
 * one tap. This keeps the user inside the app and gives them a way out.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(`[app] ${error.digest ?? "no digest"}: ${error.message}`);
  }, [error]);

  return (
    <main className="authscr">
      <div className="authbox">
        <div className="authhead">
          <h1 className="t-hero">That screen did not load.</h1>
          <p className="small">
            Something went wrong on our side. Your cases are safe.
          </p>
        </div>
        <button type="button" className="btn primary" onClick={reset}>
          Try again
        </button>
        <p className="fine authfoot">
          {/* A full document navigation on purpose. The client tree has already
              thrown, so a router transition would carry the broken state with
              it. This starts clean. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/">Back to the consult screen</a>
        </p>
        {error.digest && (
          <p className="fine authfoot" style={{ opacity: 0.6 }}>
            Reference {error.digest}
          </p>
        )}
      </div>
    </main>
  );
}
