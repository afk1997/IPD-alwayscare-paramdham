import { Readable } from 'node:stream';
import { getMediaForRead } from '@/features/media/service';
import { getCurrentUser } from '@/lib/auth';
import { NotFoundError, RbacError } from '@/lib/errors';
import { createTimings } from '@/lib/server-timing';
import { getStorage } from '@/lib/storage';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = createTimings();

  const user = await getCurrentUser();
  t.mark('auth');
  if (!user) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'server-timing': t.header() } },
    );
  }

  const { id } = await params;

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
  const webStream =
    stream instanceof Readable
      ? (Readable.toWeb(stream) as unknown as ReadableStream<Uint8Array>)
      : (stream as unknown as ReadableStream<Uint8Array>);

  const headers: Record<string, string> = {
    'content-type': asset.mimeType,
    // API-5: medical media ACLs can change (activity soft-delete, animal
    // soft-delete, role demotion). A 24h cache let stale-ACL exposure
    // linger. Switch to no-cache with revalidation — the ETag lets the
    // client get a cheap 304 when the asset hasn't changed.
    'cache-control': 'private, no-cache, max-age=0, must-revalidate',
    vary: 'cookie',
    etag: `"${asset.id}"`,
    // Hardening: don't let browsers sniff content they weren't told to.
    // Combined with finalize-time mime-family check this closes the
    // SVG-as-image stored-XSS path on the same origin.
    'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'; img-src 'self'; media-src 'self'",
    'referrer-policy': 'no-referrer',
    'server-timing': t.header(),
  };
  if (size > 0) headers['content-length'] = String(size);

  return new NextResponse(webStream, { headers });
}
