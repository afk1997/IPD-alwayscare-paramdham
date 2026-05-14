import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getStorage } from '@/lib/storage';
import { NextResponse } from 'next/server';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { id } = await params;
  const asset = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!asset) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const storage = getStorage();
  const { stream, size } = await storage.get(asset.storageKey);

  return new NextResponse(stream as unknown as ReadableStream, {
    headers: {
      'content-type': asset.mimeType,
      'content-length': String(size),
      'cache-control': 'private, max-age=86400',
      etag: `"${asset.id}"`,
    },
  });
}
