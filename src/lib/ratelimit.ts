import { prisma } from './prisma';

// Simple Prisma-backed sliding-window rate limiter. Reuses the existing
// AuditLog table — we count rows with a specific action+entityType
// scoped to the actor in the last N ms. Cheaper than standing up Redis
// for a small clinic, and audit-table writes are already cheap.

export interface RateLimitOptions {
  // Logical name for the throttled bucket, e.g. 'login', 'file.initiate'.
  bucket: string;
  // Bucket key (actor id, IP, email…). Becomes the audit `entityId`.
  key: string;
  // Window length in ms.
  windowMs: number;
  // Max events permitted in the window.
  max: number;
  // Optional context recorded with each attempt (small key-value map).
  context?: Record<string, unknown>;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

export async function rateLimit({
  bucket,
  key,
  windowMs,
  max,
  context,
}: RateLimitOptions): Promise<RateLimitResult> {
  const since = new Date(Date.now() - windowMs);
  const recent = await prisma.auditLog.count({
    where: {
      action: 'update',
      entityType: `RateLimit:${bucket}`,
      entityId: key,
      createdAt: { gte: since },
    },
  });
  if (recent >= max) {
    return { ok: false, remaining: 0, retryAfterSec: Math.ceil(windowMs / 1000) };
  }
  await prisma.auditLog.create({
    data: {
      actorId: null,
      action: 'update',
      entityType: `RateLimit:${bucket}`,
      entityId: key,
      context: (context ?? null) as never,
    },
  });
  return { ok: true, remaining: max - recent - 1, retryAfterSec: 0 };
}
