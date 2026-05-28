import type { NextConfig } from 'next';

const securityHeaders = [
  // HSTS — only meaningful behind HTTPS, harmless behind localhost.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  // Internal clinical tool — never index.
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "media-src 'self' blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.googleapis.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: false,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  images: {
    // Hold optimized variants for up to one year before re-running the
    // transform.  Combined with stable signed URLs (PR 1's media-sign)
    // this keeps total transformations to ~(assets × widths × formats)
    // for the entire project's lifetime.
    minimumCacheTTL: 60 * 60 * 24 * 365,
    formats: ['image/avif', 'image/webp'],
    // Cap variant explosion.  Each entry is one transformation per asset.
    deviceSizes: [320, 640, 1080],
    imageSizes: [64, 200, 400],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
