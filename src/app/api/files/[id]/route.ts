import { Readable } from 'node:stream';
import { getMediaForRead } from '@/features/media/service';
import { getCurrentUser } from '@/lib/auth';
import { NotFoundError, RbacError } from '@/lib/errors';
import { getStorage } from '@/lib/storage';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { id } = await params;

  let asset: Awaited<ReturnType<typeof getMediaForRead>>;
  try {
    asset = await getMediaForRead({ id: user.id, role: user.role }, id);
  } catch (e) {
    if (e instanceof NotFoundError) return NextResponse.json({ error: e.message }, { status: 404 });
    if (e instanceof RbacError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }

  if (asset.status === 'PENDING') {
    // 425 Too Early — the client raced our /finalize.
    return NextResponse.json({ error: 'asset still uploading' }, { status: 425 });
  }
  if (asset.status === 'FAILED' || !asset.storageKey) {
    return NextResponse.json({ error: 'asset unavailable' }, { status: 410 });
  }

  const { stream, size } = await getStorage().get(asset.storageKey);
  const webStream =
    stream instanceof Readable
      ? (Readable.toWeb(stream) as unknown as ReadableStream<Uint8Array>)
      : (stream as unknown as ReadableStream<Uint8Array>);

  const headers: Record<string, string> = {
    'content-type': asset.mimeType,
    'cache-control': 'private, max-age=86400',
    etag: `"${asset.id}"`,
    // Hardening: don't let browsers sniff content they weren't told to.
    // Combined with finalize-time mime-family check this closes the
    // SVG-as-image stored-XSS path on the same origin.
    'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'; img-src 'self'; media-src 'self'",
    'referrer-policy': 'no-referrer',
  };
  if (size > 0) headers['content-length'] = String(size);

  return new NextResponse(webStream, { headers });
}
