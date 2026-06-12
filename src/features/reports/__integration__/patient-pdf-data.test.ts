import { getPatientReportData } from '@/features/reports/patient-pdf/data';
import { ADMIN_EMAIL, DOCTOR_EMAIL, actorByEmail, purgeQa, qaName } from '@/lib/__integration__/helpers';
import { prisma } from '@/lib/prisma';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('getPatientReportData — integration vs real DB', () => {
  beforeAll(purgeQa);
  afterAll(purgeQa);

  it('returns discharge summary, instructions, by-name and generatedByName', async () => {
    const admin = await actorByEmail(ADMIN_EMAIL);
    const doctor = await actorByEmail(DOCTOR_EMAIL);
    const animal = await prisma.animal.create({
      data: {
        name: qaName('ReportV2'),
        species: 'Dog',
        complaint: 'QA: report v2',
        vaccination: 'NONE',
        status: 'DISCHARGED',
        dischargedAt: new Date('2026-06-10T10:00:00Z'),
        createdById: admin.id,
        dischargeRecord: {
          create: {
            summary: 'Recovered well',
            instructions: 'Cone for 5 days',
            dischargedAt: new Date('2026-06-10T10:00:00Z'),
            dischargedById: doctor.id,
          },
        },
      },
    });
    const model = await getPatientReportData(animal.id, 'QA Generator');
    expect(model).not.toBeNull();
    expect(model?.outcome.kind).toBe('discharged');
    expect(model?.outcome.summary).toBe('Recovered well');
    expect(model?.outcome.instructions).toBe('Cone for 5 days');
    expect(model?.outcome.byName).toBe(doctor.name);
    expect(model?.generatedByName).toBe('QA Generator');
  });
});
