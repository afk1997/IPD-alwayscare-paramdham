import { Readable } from 'node:stream';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getStorage } from '@/lib/storage';
import { NextResponse } from 'next/server';

// Force Node.js runtime so the storage adapters that use the Node `stream`
// and `googleapis` SDK work; the edge runtime would reject them.
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { id } = await params;
  const asset = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!asset) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const storage = getStorage();
  const { stream, size } = await storage.get(asset.storageKey);

  // Convert Node Readable → Web ReadableStream for NextResponse.
  const webStream =
    stream instanceof Readable
      ? (Readable.toWeb(stream) as unknown as ReadableStream<Uint8Array>)
      : (stream as unknown as ReadableStream<Uint8Array>);

  const headers: Record<string, string> = {
    'content-type': asset.mimeType,
    'cache-control': 'private, max-age=86400',
    etag: `"${asset.id}"`,
  };
  if (size > 0) headers['content-length'] = String(size);

  return new NextResponse(webStream, { headers });
}
