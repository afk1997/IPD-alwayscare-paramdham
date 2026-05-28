import { Readable } from 'node:stream';
import { getMediaForRead } from '@/features/media/service';
import { getCurrentUser } from '@/lib/auth';
import { NotFoundError, RbacError } from '@/lib/errors';
import { verifyMediaUrl } from '@/lib/media-sign';
import { prisma } from '@/lib/prisma';
import { getStorage } from '@/lib/storage';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function toWebStream(stream: NodeJS.ReadableStream): ReadableStream<Uint8Array> {
  if (stream instanceof Readable) return Readable.toWeb(stream) as unknown as ReadableStream<Uint8Array>;
  return stream as unknown as ReadableStream<Uint8Array>;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const search = new URL(req.url).searchParams;

  if (search.has('sig')) {
    // ── Signed path — no cookie, no DB authz, no Drive metadata RTT ──
    const v = verifyMediaUrl(id, search);
    if (!v.ok) {
      return NextResponse.json({ error: v.reason }, { status: 401 });
    }
    const asset = await prisma.mediaAsset.findUnique({
      where: { id },
      select: { id: true, status: true, storageKey: true, mimeType: true, size: true },
    });
    if (!asset || asset.status !== 'READY' || !asset.storageKey) {
      return NextResponse.json({ error: 'unavailable' }, { status: 410 });
    }
    const { stream } = await getStorage().getStreamOnly(asset.storageKey);
    const headers: Record<string, string> = {
      'content-type': asset.mimeType,
      'cache-control': 'public, max-age=600, s-maxage=600, immutable',
      etag: `"${asset.id}-${v.variant}"`,
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; img-src 'self'; media-src 'self'",
      'referrer-policy': 'no-referrer',
    };
    if (asset.size > 0) headers['content-length'] = String(asset.size);
    return new NextResponse(toWebStream(stream), { headers });
  }

  // ── Cookie path (unchanged behavior, kept for backward compat) ──
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  let asset: Awaited<ReturnType<typeof getMediaForRead>>;
  try {
    asset = await getMediaForRead({ id: user.id, role: user.role }, id);
  } catch (e) {
    if (e instanceof NotFoundError) return NextResponse.json({ error: e.message }, { status: 404 });
    if (e instanceof RbacError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }

  if (asset.status === 'PENDING') {
    return NextResponse.json({ error: 'asset still uploading' }, { status: 425 });
  }
  if (asset.status === 'FAILED' || !asset.storageKey) {
    return NextResponse.json({ error: 'asset unavailable' }, { status: 410 });
  }

  const { stream, size } = await getStorage().get(asset.storageKey);

  const headers: Record<string, string> = {
    'content-type': asset.mimeType,
    'cache-control': 'private, no-cache, max-age=0, must-revalidate',
    vary: 'cookie',
    etag: `"${asset.id}"`,
    'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'; img-src 'self'; media-src 'self'",
    'referrer-policy': 'no-referrer',
  };
  if (size > 0) headers['content-length'] = String(size);

  return new NextResponse(toWebStream(stream), { headers });
}
