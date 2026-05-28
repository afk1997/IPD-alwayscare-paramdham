import { Readable } from 'node:stream';
import { getMediaForRead, getSignedMediaForRead } from '@/features/media/service';
import { getCurrentUser } from '@/lib/auth';
import { NotFoundError, RbacError } from '@/lib/errors';
import { verifyMediaUrl } from '@/lib/media-sign';
import { createTimings } from '@/lib/server-timing';
import { getStorage } from '@/lib/storage';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function toWebStream(stream: NodeJS.ReadableStream): ReadableStream<Uint8Array> {
  if (stream instanceof Readable) return Readable.toWeb(stream) as unknown as ReadableStream<Uint8Array>;
  return stream as unknown as ReadableStream<Uint8Array>;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = createTimings();
  const { id } = await params;
  const search = new URL(req.url).searchParams;

  if (search.has('sig')) {
    // ── Signed path — no cookie, no DB authz, no Drive metadata RTT ──
    const v = verifyMediaUrl(id, search);
    t.mark('sig');
    if (!v.ok) {
      return NextResponse.json(
        { error: v.reason },
        { status: 401, headers: { 'server-timing': t.header() } },
      );
    }
    // Verifies READY status AND that the asset still resolves under the
    // soft-delete ACL (a trashed clinical record revokes its signed URLs).
    const asset = await getSignedMediaForRead(id);
    t.mark('db');
    if (!asset) {
      return NextResponse.json(
        { error: 'unavailable' },
        { status: 410, headers: { 'server-timing': t.header() } },
      );
    }
    const { stream } = await getStorage().getStreamOnly(asset.storageKey);
    t.mark('storage');
    const headers: Record<string, string> = {
      'content-type': asset.mimeType,
      'cache-control': 'public, max-age=600, s-maxage=600, immutable',
      etag: `"${asset.id}-${v.variant}"`,
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; img-src 'self'; media-src 'self'",
      'referrer-policy': 'no-referrer',
      'server-timing': t.header(),
    };
    if (asset.size > 0) headers['content-length'] = String(asset.size);
    return new NextResponse(toWebStream(stream), { headers });
  }

  // ── Cookie path (unchanged behavior, kept for backward compat) ──
  const user = await getCurrentUser();
  t.mark('auth');
  if (!user) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'server-timing': t.header() } },
    );
  }

  let asset: Awaited<ReturnType<typeof getMediaForRead>>;
  try {
    asset = await getMediaForRead({ id: user.id, role: user.role }, id);
  } catch (e) {
    t.mark('db');
    if (e instanceof NotFoundError)
      return NextResponse.json(
        { error: e.message },
        { status: 404, headers: { 'server-timing': t.header() } },
      );
    if (e instanceof RbacError)
      return NextResponse.json(
        { error: e.message },
        { status: 403, headers: { 'server-timing': t.header() } },
      );
    throw e;
  }
  t.mark('db');

  if (asset.status === 'PENDING') {
    // 425 Too Early — the client raced our /finalize.
    return NextResponse.json(
      { error: 'asset still uploading' },
      { status: 425, headers: { 'server-timing': t.header() } },
    );
  }
  if (asset.status === 'FAILED' || !asset.storageKey) {
    return NextResponse.json(
      { error: 'asset unavailable' },
      { status: 410, headers: { 'server-timing': t.header() } },
    );
  }

  const { stream, size } = await getStorage().get(asset.storageKey);
  t.mark('storage');

  const headers: Record<string, string> = {
    'content-type': asset.mimeType,
    'cache-control': 'private, no-cache, max-age=0, must-revalidate',
    vary: 'cookie',
    etag: `"${asset.id}"`,
    'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'; img-src 'self'; media-src 'self'",
    'referrer-policy': 'no-referrer',
    'server-timing': t.header(),
  };
  if (size > 0) headers['content-length'] = String(size);

  return new NextResponse(toWebStream(stream), { headers });
}
