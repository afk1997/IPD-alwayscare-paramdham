import { writeAuditLog } from '@/lib/audit';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

// API-2: clean up PENDING MediaAsset rows older than 24h. These come
// from initiate calls that never finalized (client crash, network
// drop, abandoned form). Without cleanup they accumulate forever and
// the Drive files behind them stay parked under their pending folder.

const PENDING_TTL_MS = 24 * 60 * 60 * 1000;

function unauthorized() {
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
}

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return NextResponse.json({ error: 'CRON_SECRET not set' }, { status: 500 });
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${expected}`) return unauthorized();

  const cutoff = new Date(Date.now() - PENDING_TTL_MS);
  const stale = await prisma.mediaAsset.findMany({
    where: { status: 'PENDING', createdAt: { lt: cutoff } },
    select: { id: true, storageKey: true, uploadedById: true, createdAt: true },
    take: 500,
  });

  let removed = 0;
  for (const row of stale) {
    await prisma.$transaction(async (tx) => {
      // Only remove rows that have no live links — be conservative.
      const [animalMedia, activityMedia, documents] = await Promise.all([
        tx.animalMedia.count({ where: { assetId: row.id } }),
        tx.activityMedia.count({ where: { assetId: row.id } }),
        tx.document.count({ where: { fileId: row.id } }),
      ]);
      if (animalMedia + activityMedia + documents > 0) return;
      await tx.mediaAsset.delete({ where: { id: row.id } });
      await writeAuditLog(tx, {
        actorId: null,
        action: 'delete',
        entityType: 'MediaAsset',
        entityId: row.id,
        context: { reason: 'pending-ttl', uploadedById: row.uploadedById },
      });
      removed += 1;
    });
  }

  return NextResponse.json(
    { ok: true, examined: stale.length, removed, cutoff: cutoff.toISOString() },
    { headers: { 'cache-control': 'no-store' } },
  );
}
