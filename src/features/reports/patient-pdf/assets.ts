import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Same packaging mechanism as fonts.ts: a static file inside the feature,
// resolved from the project root so Vercel's file tracing bundles it.
const LOGO_PATH = join(process.cwd(), 'src/features/reports/patient-pdf/assets/logo.png');

// 600×336 PNG with alpha. Cached after first read; null when unreadable —
// the report renders a text fallback instead (the logo must never break
// generation).
let cached: Buffer | null | undefined;
export function loadLogo(): Buffer | null {
  if (cached !== undefined) return cached;
  try {
    cached = readFileSync(LOGO_PATH);
  } catch {
    cached = null;
  }
  return cached;
}

// Intrinsic aspect ratio of assets/logo.png (600×336) — react-pdf needs
// explicit width AND height for predictable layout.
export const LOGO_AR = 336 / 600;
