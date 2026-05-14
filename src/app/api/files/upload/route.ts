import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getStorage } from '@/lib/storage';
import { NextResponse } from 'next/server';
import sharp from 'sharp';

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

type Kind = 'PHOTO' | 'VIDEO' | 'DOC';

function classify(mime: string, size: number): { kind: Kind } | { error: string; status: number } {
  if (mime.startsWith('image/')) {
    if (size > MAX_IMAGE_BYTES) return { error: 'image too large', status: 413 };
    return { kind: 'PHOTO' };
  }
  if (mime.startsWith('video/')) {
    if (size > MAX_VIDEO_BYTES) return { error: 'video too large', status: 413 };
    return { kind: 'VIDEO' };
  }
  if (mime === 'application/pdf') {
    return { kind: 'DOC' };
  }
  return { error: `unsupported mime: ${mime}`, status: 415 };
}

async function imageMeta(buf: Buffer): Promise<{ width?: number; height?: number }> {
  try {
    const meta = await sharp(buf).metadata();
    return { width: meta.width, height: meta.height };
  } catch {
    return {};
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'no file provided' }, { status: 400 });
  }

  const classified = classify(file.type, file.size);
  if ('error' in classified) {
    return NextResponse.json({ error: classified.error }, { status: classified.status });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const { width, height } = classified.kind === 'PHOTO' ? await imageMeta(buf) : {};

  const storage = getStorage();
  const put = await storage.put(buf, { filename: file.name, mime: file.type });

  const asset = await prisma.mediaAsset.create({
    data: {
      kind: classified.kind,
      filename: file.name,
      mimeType: file.type,
      size: put.size,
      storageKey: put.key,
      width: width ?? null,
      height: height ?? null,
      uploadedById: user.id,
    },
  });

  return NextResponse.json({
    id: asset.id,
    kind: asset.kind,
    filename: asset.filename,
    mimeType: asset.mimeType,
    width: asset.width,
    height: asset.height,
  });
}
