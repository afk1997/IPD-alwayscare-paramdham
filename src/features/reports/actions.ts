'use server';
import { getCurrentUser } from '@/lib/auth';
import { NotFoundError, RbacError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { assertCan } from '@/lib/rbac';
import { z } from 'zod';
import { formatDailyReportText } from './dailyReportText';
import { listActivitiesOnDateForAnimal } from './queries';

async function requireActor() {
  const user = await getCurrentUser();
  if (!user) throw new RbacError('not authenticated');
  return user;
}

export interface PatientShareResult {
  ok: boolean;
  text?: string;
  error?: string;
}

const InputSchema = z.object({
  animalId: z.string().cuid(),
  dateISO: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export async function getPatientDailyShareTextAction(
  animalId: string,
  dateISO?: string,
): Promise<PatientShareResult> {
  try {
    const actor = await requireActor();
    assertCan(actor, 'animal.read');
    const parsed = InputSchema.safeParse({ animalId, dateISO });
    if (!parsed.success) return { ok: false, error: 'Invalid input' };

    const animal = await prisma.animal.findFirst({
      where: { id: parsed.data.animalId, deletedAt: null },
      select: { id: true },
    });
    if (!animal) return { ok: false, error: 'Patient not found' };

    const date = parsed.data.dateISO ?? new Date().toISOString().slice(0, 10);
    const rows = await listActivitiesOnDateForAnimal(new Date(date), parsed.data.animalId);
    const text = formatDailyReportText(date, rows);
    return { ok: true, text };
  } catch (e) {
    if (e instanceof RbacError) return { ok: false, error: e.message };
    if (e instanceof NotFoundError) return { ok: false, error: 'Not found' };
    console.error(
      '[reports/actions] getPatientDailyShareTextAction',
      e instanceof Error ? e.message : 'unknown',
    );
    return { ok: false, error: 'Could not generate report' };
  }
}
