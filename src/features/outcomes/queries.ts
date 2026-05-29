import { prisma } from '@/lib/prisma';

const REGISTER_CAP = 100;

function todayBounds(): { start: Date; upper: Date } {
  const now = new Date();
  const start = new Date();
  start.setHours(0, 0, 0, 0); // IST midnight (server runtime is pinned to Asia/Kolkata)
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, upper: now < end ? now : end };
}

export interface DeathRow {
  animalId: string;
  animalName: string;
  animalSpecies: string;
  causeOfDeath: string;
  diedAt: Date;
  recordedByName: string;
}

export interface DischargeRow {
  animalId: string;
  animalName: string;
  animalSpecies: string;
  summary: string;
  dischargedAt: Date;
  dischargedByName: string;
}

export async function listDeaths(): Promise<DeathRow[]> {
  const rows = await prisma.deathRecord.findMany({
    where: { invalidatedAt: null, animal: { deletedAt: null } },
    orderBy: { diedAt: 'desc' },
    take: REGISTER_CAP,
    select: {
      animalId: true,
      causeOfDeath: true,
      diedAt: true,
      recordedBy: { select: { name: true } },
      animal: { select: { name: true, species: true } },
    },
  });
  return rows.map((r) => ({
    animalId: r.animalId,
    animalName: r.animal.name,
    animalSpecies: r.animal.species,
    causeOfDeath: r.causeOfDeath,
    diedAt: r.diedAt,
    recordedByName: r.recordedBy.name,
  }));
}

export async function listDischarges(): Promise<DischargeRow[]> {
  const rows = await prisma.dischargeRecord.findMany({
    where: { invalidatedAt: null, animal: { deletedAt: null } },
    orderBy: { dischargedAt: 'desc' },
    take: REGISTER_CAP,
    select: {
      animalId: true,
      summary: true,
      dischargedAt: true,
      dischargedBy: { select: { name: true } },
      animal: { select: { name: true, species: true } },
    },
  });
  return rows.map((r) => ({
    animalId: r.animalId,
    animalName: r.animal.name,
    animalSpecies: r.animal.species,
    summary: r.summary,
    dischargedAt: r.dischargedAt,
    dischargedByName: r.dischargedBy.name,
  }));
}

export interface TodayLifecycleRow {
  id: string;
  name: string;
  species: string;
  at: Date;
  detail: string | null;
  byName: string | null;
}

export async function listTodayDeaths(): Promise<TodayLifecycleRow[]> {
  const { start, upper } = todayBounds();
  const rows = await prisma.animal.findMany({
    where: { deceasedAt: { gte: start, lte: upper }, deletedAt: null },
    orderBy: { deceasedAt: 'desc' },
    select: {
      id: true,
      name: true,
      species: true,
      deceasedAt: true,
      deathRecord: { select: { causeOfDeath: true, recordedBy: { select: { name: true } } } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    species: r.species,
    at: r.deceasedAt as Date,
    detail: r.deathRecord?.causeOfDeath ?? null,
    byName: r.deathRecord?.recordedBy.name ?? null,
  }));
}

export async function listTodayDischarges(): Promise<TodayLifecycleRow[]> {
  const { start, upper } = todayBounds();
  const rows = await prisma.animal.findMany({
    where: { dischargedAt: { gte: start, lte: upper }, deletedAt: null },
    orderBy: { dischargedAt: 'desc' },
    select: {
      id: true,
      name: true,
      species: true,
      dischargedAt: true,
      dischargeRecord: { select: { summary: true, dischargedBy: { select: { name: true } } } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    species: r.species,
    at: r.dischargedAt as Date,
    detail: r.dischargeRecord?.summary ?? null,
    byName: r.dischargeRecord?.dischargedBy.name ?? null,
  }));
}

export async function listTodayAdmissions(): Promise<TodayLifecycleRow[]> {
  const { start, upper } = todayBounds();
  const rows = await prisma.animal.findMany({
    where: { admittedAt: { gte: start, lte: upper }, deletedAt: null },
    orderBy: { admittedAt: 'desc' },
    select: { id: true, name: true, species: true, admittedAt: true },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    species: r.species,
    at: r.admittedAt,
    detail: null,
    byName: null,
  }));
}

export interface TodayLifecycleEvent {
  animalId: string;
  animalName: string;
  kind: 'admission' | 'discharge' | 'death';
  at: string;
  detail: string | null;
}

export async function listTodayLifecycleEvents(): Promise<TodayLifecycleEvent[]> {
  const { start, upper } = todayBounds();
  const [admitted, discharged, deceased] = await Promise.all([
    prisma.animal.findMany({
      where: { admittedAt: { gte: start, lte: upper }, deletedAt: null },
      select: { id: true, name: true, admittedAt: true, complaint: true },
    }),
    prisma.dischargeRecord.findMany({
      where: { invalidatedAt: null, dischargedAt: { gte: start, lte: upper }, animal: { deletedAt: null } },
      select: { animalId: true, summary: true, dischargedAt: true, animal: { select: { name: true } } },
    }),
    prisma.deathRecord.findMany({
      where: { invalidatedAt: null, diedAt: { gte: start, lte: upper }, animal: { deletedAt: null } },
      select: { animalId: true, causeOfDeath: true, diedAt: true, animal: { select: { name: true } } },
    }),
  ]);
  return [
    ...admitted.map((a) => ({
      animalId: a.id,
      animalName: a.name,
      kind: 'admission' as const,
      at: a.admittedAt.toISOString(),
      detail: a.complaint,
    })),
    ...discharged.map((d) => ({
      animalId: d.animalId,
      animalName: d.animal.name,
      kind: 'discharge' as const,
      at: d.dischargedAt.toISOString(),
      detail: d.summary,
    })),
    ...deceased.map((d) => ({
      animalId: d.animalId,
      animalName: d.animal.name,
      kind: 'death' as const,
      at: d.diedAt.toISOString(),
      detail: d.causeOfDeath,
    })),
  ];
}
