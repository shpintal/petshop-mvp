import path from "node:path";
const API_URL = process.env.API_URL ?? "http://127.0.0.1:4000/api/v1";
const csp = [
  "default-src 'self'", "img-src 'self' data:", "style-src 'self' 'unsafe-inline'",
  // Прототип: Next.js вставляє inline-скрипти гідратації. Прод: CSP з nonce через proxy (див. ROADMAP).
  "script-src 'self' 'unsafe-inline'", "connect-src 'self'", "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self' https://www.liqpay.ua",
].join("; ");
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Перевірка типів — окремий крок `npm run typecheck` (tsc --noEmit)
  typescript: { ignoreBuildErrors: true },
  turbopack: { root: path.resolve(".") },
  experimental: { workerThreads: true, cpus: 1 },
  poweredByHeader: false,
  // Браузер звертається до same-origin /api/v1 → проксі на Commerce API (без CORS)
  async rewrites() { return [{ source: "/api/v1/:path*", destination: `${API_URL}/:path*` }]; },
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "Content-Security-Policy", value: csp }, { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }, { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(self)" },
    ] }];
  },
};
export default nextConfig;
