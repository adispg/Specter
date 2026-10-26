/* Specter service worker: a minimal app shell.
 * - Static build assets, icons and fonts: cache first (they are content-hashed).
 * - Public pages: network first, falling back to the cached copy, then /offline.
 * - Signed-in pages, API and auth routes are never cached.
 *
 * Two problems this file used to have:
 *
 * 1. It cached every successful navigation, including "/" and "/cases/<id>",
 *    which hold the user's own situations and advice. Sign out cleared the
 *    Supabase session but not these caches, so on a shared device a later
 *    network failure could serve the previous user's case. Only the public
 *    shell is cached now, so there is nothing private left to leak.
 *
 * 2. VERSION was the hardcoded string "specter-v1", so the activate handler's
 *    eviction never fired: the cache was never invalidated across deploys and
 *    grew without bound. The version now comes from the build id, passed on the
 *    registration URL, so each deploy installs a new worker and drops the old
 *    cache. That also purges anything the previous version cached.
 */

const BUILD = new URL(self.location.href).searchParams.get("v") || "dev";
const VERSION = `specter-${BUILD}`;

const SHELL = ["/offline", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/brand/icon.svg"];

/** Only these pages are cached. Everything else is behind auth and private. */
const PUBLIC_PAGES = ["/offline", "/welcome", "/sign-in", "/privacy", "/terms", "/safety"];

function isPublicPage(pathname) {
  return PUBLIC_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((c) => c.addAll(SHELL))
      // One missing entry rejects addAll and the worker never installs, which is
      // what happened while /offline did not exist. Never block install on it.
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Lets the app drop everything on sign out, as defence in depth. */
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "clear-caches") {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))));
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/brand/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone()));
            return res;
          }),
      ),
    );
    return;
  }

  if (req.mode === "navigate") {
    const cacheable = isPublicPage(url.pathname);
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (cacheable && res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        // A signed-in page has no cached copy by design, so it falls through to
        // the offline page rather than showing someone else's answer.
        .catch(() => (cacheable ? caches.match(req).then((hit) => hit || caches.match("/offline")) : caches.match("/offline"))),
    );
  }
});
