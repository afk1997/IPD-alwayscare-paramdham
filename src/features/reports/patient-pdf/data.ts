import { filterBounds } from '@/features/activities/filter';
import { prisma } from '@/lib/prisma';
import {
  type MediaKindLite,
  type RawMedia,
  type RawReportData,
  type ReportModel,
  buildReportModel,
} from './model';

type MediaRow = {
  label: string | null;
  asset: { id: string; kind: string; filename: string; storageKey: string };
};
const toRawMedia = (m: MediaRow): RawMedia => ({
  assetId: m.asset.id,
  kind: m.asset.kind as MediaKindLite,
  label: m.label ?? null,
  filename: m.asset.filename,
  storageKey: m.asset.storageKey,
});

export async function getPatientReportData(
  animalId: string,
  range?: { from: string; to: string },
): Promise<ReportModel | null> {
  const animal = await prisma.animal.findFirst({
    where: { id: animalId, deletedAt: null },
    include: {
      cage: { select: { name: true } },
      media: { where: { asset: { status: 'READY' } }, orderBy: { order: 'asc' }, include: { asset: true } },
      deathRecord: { select: { causeOfDeath: true, diedAt: true, invalidatedAt: true } },
      dischargeRecord: { select: { dischargedAt: true, invalidatedAt: true } },
    },
  });
  if (!animal) return null;

  const where: { animalId: string; deletedAt: null; occurredAt?: { gte: Date; lte: Date } } = {
    animalId,
    deletedAt: null,
  };
  if (range) {
    const b = filterBounds({ kind: 'custom', from: range.from, to: range.to }, new Date());
    if (b) where.occurredAt = { gte: new Date(b.start), lte: new Date(b.end) };
  }
  const activities = await prisma.activity.findMany({
    where,
    orderBy: { occurredAt: 'asc' },
    include: { media: { where: { asset: { status: 'READY' } }, include: { asset: true } } },
  });
  const docs = await prisma.document.findMany({
    where: { animalId, deletedAt: null },
    orderBy: [{ category: 'asc' }, { createdAt: 'desc' }],
    include: { file: true },
  });

  const death =
    animal.deathRecord && !animal.deathRecord.invalidatedAt
      ? { causeOfDeath: animal.deathRecord.causeOfDeath, diedAt: animal.deathRecord.diedAt.toISOString() }
      : null;
  const discharge =
    animal.dischargeRecord && !animal.dischargeRecord.invalidatedAt
      ? { dischargedAt: animal.dischargeRecord.dischargedAt.toISOString() }
      : null;

  const raw: RawReportData = {
    generatedAt: new Date().toISOString(),
    range: range ?? null,
    animal: {
      name: animal.name,
      species: animal.species,
      breed: animal.breed,
      gender: animal.gender,
      ageText: animal.ageText,
      ward: animal.ward,
      cageName: animal.cage?.name ?? null,
      status: animal.status,
      admittedAt: animal.admittedAt.toISOString(),
      complaint: animal.complaint,
      diagnosis: animal.diagnosis,
      rescuer: animal.rescuer,
      broughtBy: animal.broughtBy,
      media: animal.media.map(toRawMedia),
      death,
      discharge,
    },
    activities: activities.map((a) => ({
      type: a.type,
      occurredAt: a.occurredAt.toISOString(),
      byName: a.byName,
      editedAt: a.editedAt?.toISOString() ?? null,
      remarks: a.remarks,
      data: a.data,
      media: a.media.map(toRawMedia),
    })),
    documents: docs.map((d) => ({
      id: d.id,
      category: d.category,
      kind: d.kind,
      name: d.name,
      createdAt: d.createdAt.toISOString(),
      file: d.file
        ? {
            assetId: d.file.id,
            kind: d.file.kind as MediaKindLite,
            filename: d.file.filename,
            storageKey: d.file.storageKey,
          }
        : null,
    })),
  };
  return buildReportModel(raw);
}

// Every still asset the PDF embeds (activity photos/x-rays + admission + document images).
export function collectImageAssets(model: ReportModel): { assetId: string; storageKey: string }[] {
  const out = new Map<string, string>();
  for (const m of model.admissionMedia) out.set(m.assetId, m.storageKey);
  for (const d of model.days)
    for (const e of d.entries) for (const m of e.stills) out.set(m.assetId, m.storageKey);
  for (const doc of model.documents)
    if (doc.file && (doc.file.kind === 'PHOTO' || doc.file.kind === 'XRAY'))
      out.set(doc.file.assetId, doc.file.storageKey);
  return Array.from(out.entries()).map(([assetId, storageKey]) => ({ assetId, storageKey }));
}
