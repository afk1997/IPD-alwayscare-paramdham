import { finalizeUpload } from '@/features/media/service';
import { getCurrentUser } from '@/lib/auth';
import { NotFoundError, RbacError, ValidationError } from '@/lib/errors';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';

const BodySchema = z.object({
  assetId: z.string().min(1),
  driveFileId: z.string().min(1),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'bad request' }, { status: 400 });

  try {
    const asset = await finalizeUpload({ id: user.id, role: user.role }, parsed.data);
    return NextResponse.json({
      id: asset.id,
      status: asset.status,
      kind: asset.kind,
      filename: asset.filename,
      width: asset.width,
      height: asset.height,
      durationSec: asset.durationSec,
    });
  } catch (e) {
    if (e instanceof RbacError) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof NotFoundError) return NextResponse.json({ error: e.message }, { status: 404 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
