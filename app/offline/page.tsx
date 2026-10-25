import { Wordmark } from "@/components/Wordmark";

export const metadata = { title: "Offline" };

/**
 * Served by the service worker when a navigation fails and no cached copy of
 * that page exists. This route is also precached in public/sw.js: it was listed
 * in the shell but never built, and cache.addAll rejects the whole batch if any
 * entry 404s, so the worker's install step failed on every load and nothing was
 * ever cached.
 */
export default function OfflinePage() {
  return (
    <main className="authscr">
      <div className="authbox">
        <Wordmark />
        <div className="authhead">
          <h1 className="t-hero">No connection.</h1>
          <p className="small">
            Cases you have already opened are still here. New advice needs a connection.
          </p>
        </div>
        {/* A real document navigation, not a client transition: the point is to
            retry the network and re-run the service worker, which router
            navigation inside a cached shell would skip. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="btn primary" href="/">
          Try again
        </a>
      </div>
    </main>
  );
}
