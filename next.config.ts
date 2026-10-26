import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=()" },
];

/**
 * Identifies this build. The service worker takes its cache name from this, so
 * a deploy installs a new worker and evicts the previous cache; with a
 * hardcoded name the eviction in its activate handler never ran at all.
 * Vercel supplies the commit sha; locally the start time stands in.
 */
const buildId = (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 12) || `dev-${Date.now()}`;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  generateBuildId: () => buildId,
  env: { NEXT_PUBLIC_BUILD_ID: buildId },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
