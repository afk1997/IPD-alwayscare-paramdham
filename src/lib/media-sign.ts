import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * HMAC-signed URLs for /api/files/[id].
 *
 * The signature is stable per (assetId, variant) — there is no
 * expiry parameter.  This is deliberate: Next image optimization
 * uses the full source URL as part of its cache key, so a rotating
 * URL would blow Vercel's image transformation quota every time
 * the bucket flipped.  Stable URLs collapse the transformation
 * count to ~(assets × widths × formats) over the project's life.
 *
 * Security boundary: the URL is a permanent capability token
 * valid until AUTH_SECRET rotates.  Acceptable for the Arham IPD
 * threat model (small clinical staff, no external surface).  See
 * the spec at docs/superpowers/specs/2026-05-28-app-performance-design.md
 * for the full rationale.
 */

const SIG_LEN = 22; // base64url chars (~128 bits of strength)

export type MediaVariant = 'orig';

export function signMediaUrl(assetId: string, opts: { variant?: MediaVariant } = {}): string {
  const variant = opts.variant ?? 'orig';
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET required for signing media URLs');
  const sig = createHmac('sha256', secret)
    .update(`${assetId}|${variant}`)
    .digest('base64url')
    .slice(0, SIG_LEN);
  return `/api/files/${assetId}?v=${variant}&sig=${sig}`;
}

export type VerifyResult = { ok: true; variant: MediaVariant } | { ok: false; reason: string };

export function verifyMediaUrl(assetId: string, search: URLSearchParams): VerifyResult {
  const v = search.get('v') ?? '';
  const sig = search.get('sig') ?? '';
  if (v !== 'orig') return { ok: false, reason: 'unknown variant' };
  if (sig.length !== SIG_LEN) return { ok: false, reason: 'bad sig length' };
  const secret = process.env.AUTH_SECRET;
  if (!secret) return { ok: false, reason: 'no secret' };
  const want = createHmac('sha256', secret).update(`${assetId}|${v}`).digest('base64url').slice(0, SIG_LEN);
  const a = Buffer.from(sig);
  const b = Buffer.from(want);
  if (a.length !== b.length) return { ok: false, reason: 'sig mismatch' };
  if (!timingSafeEqual(a, b)) return { ok: false, reason: 'sig mismatch' };
  return { ok: true, variant: 'orig' };
}
