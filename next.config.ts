import withSerwistInit from '@serwist/next';
import type { NextConfig } from 'next';

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
  reloadOnOnline: true,
});

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
      "worker-src 'self'",
      "manifest-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/api/patients/[id]/report': [
      './src/features/reports/patient-pdf/fonts/*.ttf',
      './src/features/reports/patient-pdf/assets/logo.png',
    ],
  },
  // @react-pdf/renderer ships its own React reconciler. If Next bundles it
  // under the React-Server-Components condition, renderToBuffer throws React
  // error #31 (element created by the server runtime is rejected by react-pdf's
  // reconciler). Externalizing it makes Next load it as a plain Node module
  // using the standard React, which is what its reconciler expects.
  serverExternalPackages: ['@react-pdf/renderer'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Next's default externalization emits `import("@react-pdf/renderer")`
      // (the ESM build) for the Pages-Router report route. Loaded that way —
      // through the server's module hooks — react-pdf's text layout
      // mis-renders: leading glyphs get dropped at narrow widths (meds-table
      // dose "0.2 mg/kg" rendered as ".2 mg/kg") and the registered
      // hyphenation callback is ignored (mid-word "w/eight-bearing" breaks).
      // The exact same render through `require` (CJS build, project React) is
      // pixel-correct, so pin the external to CommonJS. Verified empirically
      // in Task 7 of docs/superpowers/plans/2026-06-12-patient-report-v2.md.
      config.externals = [{ '@react-pdf/renderer': 'commonjs @react-pdf/renderer' }, ...config.externals];
    }
    return config;
  },
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
    // Required from Next 16+; emits a console warning today.  Signed
    // media URLs carry ?v=orig&sig=<22chars> as their search string.
    //
    // NOTE: `search` is matched by EXACT string equality in Next's
    // matchLocalPattern (`pattern.search !== url.search`), not glob — so a
    // pattern like `?v=orig&sig=*` only ever matches the literal `*`, never a
    // real 22-char signature.  Omitting `search` entirely skips the query
    // check so any `?v=orig&sig=…` (and the no-query cookie path) is allowed
    // through the optimizer.  Pinning the pathname keeps the SSRF allow-list.
    localPatterns: [{ pathname: '/api/files/**' }],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default withSerwist(nextConfig);
