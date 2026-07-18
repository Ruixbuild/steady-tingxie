import type { NextConfig } from "next";

// Security headers applied to every response. These harden against
// clickjacking/embedding (which also deters cloning by re-skinning),
// force HTTPS, stop MIME sniffing, and trim what's shared cross-origin.
// A full script/style CSP is intentionally left as a follow-up so it can
// be tested per-page against Next's inline bootstrap; `frame-ancestors`
// is set here because it restricts embedding without affecting rendering.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  // Never emit browser source maps in production — keeps app internals
  // out of shipped bundles (defense-in-depth for the anti-copy goal).
  productionBrowserSourceMaps: false,
  // Drop the framework-fingerprinting header.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
