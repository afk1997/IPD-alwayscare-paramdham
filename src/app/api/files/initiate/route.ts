import { initiateUpload } from '@/features/media/service';
import { getCurrentUser } from '@/lib/auth';
import { NotFoundError, RbacError, ValidationError } from '@/lib/errors';
import { rateLimit } from '@/lib/ratelimit';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 60;

const BodySchema = z.object({
  filename: z.string().min(1).max(300),
  mime: z.string().min(1).max(200),
  size: z.number().int().positive(),
  context: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('staging'),
      sessionId: z
        .string()
        .min(8)
        .max(64)
        .regex(/^[a-z0-9-]+$/),
    }),
    z.object({
      kind: z.literal('activity'),
      animalId: z.string().min(1),
      activityType: z.string().min(1),
      occurredAt: z.string().datetime(),
    }),
    z.object({
      kind: z.literal('document'),
      animalId: z.string().min(1),
      category: z.string().min(1).max(40),
    }),
  ]),
});

function safeOrigin(req: Request): string {
  // API-6: do NOT echo a client-supplied Origin into the Drive resumable
  // mint. Pin to the configured app URL, fall back to the request URL.
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured;
  const u = new URL(req.url);
  return `${u.protocol}//${u.host}`;
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  // VRC-9: throttle per actor so a single user cannot spam Drive
  // initiate calls. 60/min is plenty for normal use.
  const limit = await rateLimit({
    bucket: 'file.initiate',
    key: user.id,
    windowMs: 60_000,
    max: 60,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'rate limit exceeded' },
      {
        status: 429,
        headers: {
          'retry-after': String(limit.retryAfterSec),
          'cache-control': 'no-store',
        },
      },
    );
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'bad request' }, { status: 400 });
  }

  try {
    const result = await initiateUpload(
      { id: user.id, role: user.role },
      { ...parsed.data, origin: safeOrigin(req) },
    );
    // STO-8: never let an intermediary cache the resumable upload URL.
    return NextResponse.json(result, { headers: { 'cache-control': 'no-store' } });
  } catch (e) {
    if (e instanceof RbacError) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof NotFoundError) return NextResponse.json({ error: e.message }, { status: 404 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    // API-4 / VRC-12: log only the message/code, never the full error
    // object, which can include Drive folder IDs / OAuth context.
    console.error(
      '[api/files/initiate] code=%s msg=%s',
      (e as { code?: string })?.code ?? 'unknown',
      e instanceof Error ? e.message : 'unknown',
    );
    return NextResponse.json({ error: 'initiate failed' }, { status: 502 });
  }
}
