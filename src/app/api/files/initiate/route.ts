import { initiateUpload } from '@/features/media/service';
import { getCurrentUser } from '@/lib/auth';
import { NotFoundError, RbacError, ValidationError } from '@/lib/errors';
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

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'bad request' }, { status: 400 });
  }

  const origin =
    req.headers.get('origin') ??
    (() => {
      const u = new URL(req.url);
      return `${u.protocol}//${u.host}`;
    })();

  try {
    const result = await initiateUpload({ id: user.id, role: user.role }, { ...parsed.data, origin });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof RbacError) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof NotFoundError) return NextResponse.json({ error: e.message }, { status: 404 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    // H5-s: never echo the raw upstream error back to the client.  Drive
    // exceptions sometimes contain internal folder IDs, OAuth context,
    // and rate-limit details that have no business in the wire response.
    console.error('[api/files/initiate] upstream failure', e);
    return NextResponse.json({ error: 'initiate failed' }, { status: 502 });
  }
}
