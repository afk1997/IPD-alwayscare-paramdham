'use server';
import { getCurrentUser } from '@/lib/auth';
import { RbacError } from '@/lib/errors';
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

// Returns the WhatsApp-bold daily report for one patient.  When dateISO
// is omitted, defaults to today (uses the same UTC-truncated date that
// /reports/today uses, so the two pages stay in sync).
export async function getPatientDailyShareTextAction(
  animalId: string,
  dateISO?: string,
): Promise<PatientShareResult> {
  try {
    await requireActor();
    const date =
      dateISO && /^\d{4}-\d{2}-\d{2}$/.test(dateISO) ? dateISO : new Date().toISOString().slice(0, 10);
    const rows = await listActivitiesOnDateForAnimal(new Date(date), animalId);
    const text = formatDailyReportText(date, rows);
    return { ok: true, text };
  } catch (e) {
    if (e instanceof RbacError) return { ok: false, error: e.message };
    throw e;
  }
}
