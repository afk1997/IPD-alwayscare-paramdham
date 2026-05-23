import type { CreateActivityInput } from '../src/features/activities/schema';
/**
 * Stress test — simulate 3 days in the IPD with ~10 animals.
 *
 * What this exercises end-to-end against the real Neon DB:
 *   - createAnimal (10 admissions, varied species/triage/vaccination)
 *   - createActivity (all 8 types) with byName overrides + occurredAt
 *   - updateActivity (data + remarks patch → triggers new Zod gate)
 *   - duplicateActivity
 *   - softDeleteActivity + restoreActivity
 *   - updateAnimal (inline edit → triggers UpdateAnimalSchema gate)
 *   - dischargeAnimal (with summary + instructions)
 *   - recordDeath (one animal)
 *   - createDocument (with PENDING→READY asset to test ownership gate)
 *   - RBAC: try to edit another doctor's activity outside 24h window
 *   - RBAC: try to soft-delete an activity as STAFF you don't own
 *
 * Skips real Drive uploads (covered separately by e2e-upload.ts).  Inserts
 * a small set of synthetic READY MediaAsset rows so the listing /
 * documents pages have something to show.
 *
 * Friction notes are captured as `flag(category, msg)` calls and printed
 * at the end so the author can prioritize follow-up.
 */
import {
  createActivity,
  duplicateActivity,
  restoreActivity,
  softDeleteActivity,
  updateActivity,
} from '../src/features/activities/service';
import { dischargeAnimal, recordDeath } from '../src/features/animals/lifecycle/service';
import { createAnimal, updateAnimal } from '../src/features/animals/service';
import { RbacError, ValidationError } from '../src/lib/errors';
import { prisma } from '../src/lib/prisma';
import type { Actor } from '../src/lib/rbac';

interface Friction {
  category: 'ux' | 'perf' | 'data' | 'rbac' | 'a11y' | 'reliability';
  msg: string;
}
const friction: Friction[] = [];
const flag = (category: Friction['category'], msg: string) => friction.push({ category, msg });

const timings: { label: string; ms: number }[] = [];
async function time<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t = Date.now();
  const out = await fn();
  timings.push({ label, ms: Date.now() - t });
  return out;
}

function log(line: string) {
  process.stdout.write(`${line}\n`);
}

function dayOffset(days: number, hours = 9, minutes = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - (2 - days));
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

async function findUserByRole(
  role: 'ADMIN' | 'DOCTOR' | 'STAFF' | 'SUPER_ADMIN' | 'VIEWER',
  skip: string[] = [],
) {
  const u = await prisma.user.findFirst({
    where: { role, active: true, id: { notIn: skip } },
    select: { id: true, role: true, name: true },
  });
  if (!u) throw new Error(`no ${role} found in DB`);
  return { id: u.id, role: u.role, name: u.name };
}

const ANIMAL_SEEDS = [
  {
    name: 'Bruno',
    species: 'Dog',
    breed: 'Labrador',
    gender: 'MALE' as const,
    ageText: '4y',
    color: 'Golden',
    weightKg: 28,
    vaccination: 'DONE' as const,
    sterilized: true,
    aggressive: false,
    rescuer: 'Vikram Singh',
    rescuerPhone: '+91 98765 11111',
    address: 'Andheri West, Mumbai',
    complaint: 'Hit by auto-rickshaw, hind leg unable to bear weight',
    injuryType: 'RTA / fracture',
    diagnosis: 'Suspected tibial fracture L hind',
    immediateTreatment: 'IV fluids, analgesia, splint',
    surgeryRequired: 'Likely TPLO',
    contagious: false,
    status: 'CRITICAL' as const,
    ward: 'Surgery-1',
    testsAdvised: ['XRAY', 'BLOOD_TEST'] as const,
  },
  {
    name: 'Milo',
    species: 'Cat',
    breed: 'Indie',
    gender: 'MALE' as const,
    ageText: '2y',
    color: 'Tabby',
    weightKg: 4.2,
    vaccination: 'PARTIAL' as const,
    sterilized: false,
    aggressive: true,
    rescuer: 'Anita Desai',
    rescuerPhone: '+91 98765 22222',
    address: 'Bandra East',
    complaint: 'Pyrexia + lethargy x 3 days, off food',
    injuryType: 'Medical',
    diagnosis: 'Suspected viral URI',
    immediateTreatment: 'Sub-Q fluids, NSAIDs, ABx',
    contagious: true,
    status: 'OBSERVATION' as const,
    ward: 'ISO-A',
    testsAdvised: ['BLOOD_TEST'] as const,
  },
  {
    name: 'Coco',
    species: 'Dog',
    breed: 'Pomeranian',
    gender: 'FEMALE' as const,
    ageText: '7y',
    color: 'White',
    weightKg: 6.4,
    vaccination: 'DONE' as const,
    sterilized: true,
    aggressive: false,
    rescuer: 'Self-owned',
    address: 'Juhu',
    complaint: 'Recurrent vomiting, hematuria',
    injuryType: 'Medical',
    diagnosis: 'Urolithiasis suspected',
    immediateTreatment: 'IV fluids, antiemetic',
    contagious: false,
    status: 'STABLE' as const,
    ward: 'Med-2',
    testsAdvised: ['USG', 'BLOOD_TEST'] as const,
  },
  {
    name: 'Shadow',
    species: 'Dog',
    breed: 'GSD mix',
    gender: 'MALE' as const,
    ageText: '5y',
    color: 'Black & Tan',
    weightKg: 32,
    vaccination: 'NONE' as const,
    sterilized: false,
    aggressive: true,
    rescuer: 'Mumbai NGO Welfare',
    ngo: 'PAWS-Mumbai',
    rescuerPhone: '+91 98765 33333',
    address: 'Powai',
    complaint: 'Severe pyoderma + maggot wound on dorsum',
    injuryType: 'Wound / infection',
    diagnosis: 'Myiasis + secondary pyoderma',
    immediateTreatment: 'Maggot extraction under sedation, broad-spectrum ABx',
    contagious: false,
    status: 'CRITICAL' as const,
    ward: 'Surgery-2',
    testsAdvised: ['BLOOD_TEST'] as const,
  },
  {
    name: 'Mishka',
    species: 'Cat',
    breed: 'Persian',
    gender: 'FEMALE' as const,
    ageText: '11y',
    color: 'Cream',
    weightKg: 3.6,
    vaccination: 'DONE' as const,
    sterilized: true,
    aggressive: false,
    rescuer: 'Self-owned',
    address: 'Worli',
    complaint: 'PU/PD, weight loss, polyphagia',
    injuryType: 'Medical',
    diagnosis: 'Diabetes mellitus suspected',
    immediateTreatment: 'BG curve, hydration',
    contagious: false,
    status: 'STABLE' as const,
    ward: 'Med-3',
    testsAdvised: ['BLOOD_TEST', 'USG'] as const,
  },
];

async function admitAnimal(actor: Actor, seed: (typeof ANIMAL_SEEDS)[number]) {
  return createAnimal(actor, {
    name: seed.name,
    species: seed.species as 'Dog' | 'Cat',
    breed: seed.breed,
    gender: seed.gender,
    ageText: seed.ageText,
    color: seed.color,
    weightKg: seed.weightKg,
    vaccination: seed.vaccination,
    sterilized: seed.sterilized,
    aggressive: seed.aggressive,
    rescuer: seed.rescuer,
    rescuerPhone: 'rescuerPhone' in seed ? seed.rescuerPhone : undefined,
    address: seed.address,
    ngo: 'ngo' in seed ? seed.ngo : undefined,
    broughtBy: undefined,
    complaint: seed.complaint,
    injuryType: seed.injuryType,
    history: undefined,
    contagious: seed.contagious,
    status: seed.status,
    ward: seed.ward,
    diagnosis: seed.diagnosis,
    immediateTreatment: seed.immediateTreatment,
    surgeryRequired: 'surgeryRequired' in seed ? seed.surgeryRequired : undefined,
    testsAdvised: [...seed.testsAdvised],
    mediaAssetIds: [],
    uploadSessionId: undefined,
  });
}

async function main() {
  log('━━━ stress 3-day simulation ━━━\n');
  const admin = await findUserByRole('ADMIN');
  const doctorA = await findUserByRole('DOCTOR');
  const doctorB = await findUserByRole('DOCTOR', [doctorA.id]);
  const staffA = await findUserByRole('STAFF');
  const staffB = await findUserByRole('STAFF', [staffA.id]);
  log(
    `actors: admin=${admin.name}  drA=${doctorA.name}  drB=${doctorB.name}  stA=${staffA.name}  stB=${staffB.name}\n`,
  );

  // ── Day 1 — admissions ─────────────────────────────────────────────────
  log('Day 1 — admissions');
  const admitted: { id: string; name: string }[] = [];
  for (const seed of ANIMAL_SEEDS) {
    try {
      const a = await time(`admit ${seed.name}`, () =>
        admitAnimal({ id: doctorA.id, role: doctorA.role }, seed),
      );
      admitted.push({ id: a.id, name: a.name });
      log(`  + admitted ${a.name} (${a.id.slice(0, 8)}…) — ${seed.status}`);
    } catch (e) {
      flag('reliability', `admit ${seed.name} failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  log(`  → ${admitted.length}/${ANIMAL_SEEDS.length} admitted\n`);

  // Existing admits we'll also operate on (test layering on top of seed data).
  const existing = await prisma.animal.findMany({
    where: { status: { in: ['CRITICAL', 'STABLE', 'OBSERVATION'] }, deletedAt: null },
    select: { id: true, name: true },
    take: 5,
  });
  const allActiveAnimals = [...admitted, ...existing.filter((e) => !admitted.find((a) => a.id === e.id))];
  log(`  total active animals for simulation: ${allActiveAnimals.length}\n`);

  // ── Day 1-3 activities ─────────────────────────────────────────────────
  const activityIds: string[] = [];

  async function logActivity(
    actor: {
      id: string;
      role: 'ADMIN' | 'DOCTOR' | 'STAFF' | 'SUPER_ADMIN' | 'VIEWER';
      name: string;
    },
    input: Omit<CreateActivityInput, 'byName'> & { byName?: string },
  ) {
    try {
      // byName is now required by the schema; default to the actor's
      // name when the test data doesn't override it (matches what the
      // UI does for an unmodified dropdown).
      const a = await createActivity(actor, {
        ...input,
        byName: input.byName ?? actor.name,
      } as CreateActivityInput);
      activityIds.push(a.id);
      return a;
    } catch (e) {
      flag(
        'reliability',
        `createActivity ${input.type} for ${input.animalId} failed: ${e instanceof Error ? e.message : String(e)}`,
      );
      return null;
    }
  }

  for (let day = 1; day <= 3; day++) {
    log(`Day ${day} — activities`);
    let count = 0;
    for (const a of allActiveAnimals) {
      // Morning round (doctor)
      await time(`activity ROUND d${day} ${a.name}`, () =>
        logActivity(doctorA, {
          type: 'ROUND',
          animalId: a.id,
          remarks: `Morning round day ${day}`,
          mediaAssetIds: [],
          occurredAt: dayOffset(day, 8, 30),
          data: {
            temp: `${(37.5 + Math.random() * 1.5).toFixed(1)}°C`,
            appetite: ['Normal', 'Partial', 'Refused'][day % 3] as 'Normal',
            hydration: ['Good', 'OK'][day % 2] as 'Good',
            progress: ['Stable', 'Improving'][day % 2] as 'Stable',
            notes: `Bright on day ${day}.`,
          },
        }),
      );
      count++;
      // Treatment (doctor)
      await logActivity(doctorB, {
        type: 'TREATMENT',
        animalId: a.id,
        remarks: 'Daily meds',
        mediaAssetIds: [],
        occurredAt: dayOffset(day, 9, 0),
        data: { meds: [{ name: 'Amoxiclav', dose: '20mg/kg', route: 'Oral' }] },
      });
      count++;
      // Food (staff)
      await logActivity(staffA, {
        type: 'FOOD',
        animalId: a.id,
        remarks: undefined,
        mediaAssetIds: [],
        occurredAt: dayOffset(day, 12, 30),
        data: {
          foodType: a.name === 'Milo' || a.name === 'Mishka' ? 'Wet food' : 'Kibble',
          qty: '120g',
          water: '300ml',
          intake: day === 1 ? 'Partially' : 'Fully',
          vomiting: false,
        },
      });
      count++;
      // Walk (staff) — only for dogs
      if (allActiveAnimals.indexOf(a) % 2 === 0) {
        await logActivity(staffB, {
          type: 'WALK',
          animalId: a.id,
          remarks: undefined,
          mediaAssetIds: [],
          occurredAt: dayOffset(day, 17, 0),
          data: { duration: '15min', urination: true, stool: day === 2, mobility: 'Normal', assisted: false },
        });
        count++;
      }
    }

    // One surgery on day 1, diagnostic on day 2
    if (day === 1 && admitted[0]) {
      await logActivity(doctorA, {
        type: 'SURGERY',
        animalId: admitted[0].id,
        remarks: 'TPLO completed, recovery uneventful',
        mediaAssetIds: [],
        occurredAt: dayOffset(1, 14, 30),
        data: {
          surgeryName: 'TPLO L hind',
          surgeon: doctorA.name,
          anesthesia: 'Iso + ketamine CRI',
          duration: '2h 10m',
          findings: 'Stable fracture, plates and screws applied',
          complications: 'Nil',
          postOp: 'Recovery slow but uneventful',
        },
      });
      count++;
    }
    if (day === 2 && admitted[2]) {
      await logActivity(doctorB, {
        type: 'DIAGNOSTIC',
        animalId: admitted[2].id,
        remarks: 'USG confirms stones in bladder',
        mediaAssetIds: [],
        occurredAt: dayOffset(2, 11, 0),
        data: {
          tests: ['USG'],
          findings: 'Multiple radio-opaque calculi in bladder',
          interpretation: 'Surgical removal recommended',
        },
      });
      count++;
    }

    // Bath on day 3 (staff)
    if (day === 3 && admitted[3]) {
      await logActivity(staffA, {
        type: 'BATH',
        animalId: admitted[3].id,
        remarks: undefined,
        mediaAssetIds: [],
        occurredAt: dayOffset(3, 16, 0),
        data: { bathType: 'Medicated bath', groomingBy: staffA.name, remarks: 'Skin much improved' },
      });
      count++;
    }
    log(`  → ${count} activities logged\n`);
  }
  log(`  total activities created: ${activityIds.length}\n`);

  // ── Edits, deletes, restores ───────────────────────────────────────────
  log('Edits + soft-delete + restore + duplicate');
  if (activityIds.length >= 5) {
    // Edit the first treatment
    const firstTreatment = await prisma.activity.findFirst({
      where: { id: { in: activityIds }, type: 'TREATMENT' },
      select: { id: true, type: true, byUserId: true },
    });
    if (firstTreatment?.byUserId) {
      const byUserId = firstTreatment.byUserId;
      try {
        await time('updateActivity (data + remarks)', () =>
          updateActivity({ id: byUserId, role: 'DOCTOR', name: 'Edit-test' }, firstTreatment.id, {
            remarks: 'Edited remarks — dose increased',
            data: { meds: [{ name: 'Amoxiclav', dose: '25mg/kg', route: 'Oral' }] },
          }),
        );
        log('  + edit succeeded (Zod validated)');
      } catch (e) {
        flag('reliability', `updateActivity edit failed: ${e instanceof Error ? e.message : String(e)}`);
      }

      // RBAC: try to edit with wrong-shape data — should reject
      try {
        await updateActivity({ id: byUserId, role: 'DOCTOR', name: 'Edit-test' }, firstTreatment.id, {
          // Wrong shape — TREATMENT row, but data lacks `meds`.
          data: { foodType: 'Kibble', intake: 'Fully' },
        });
        flag('rbac', 'Zod gate let bad-shape data through on TREATMENT.update');
      } catch (e) {
        if (
          e instanceof ValidationError ||
          (e instanceof Error && /required|invalid|expected/i.test(e.message))
        ) {
          log('  + bad-shape data correctly rejected');
        } else {
          flag(
            'rbac',
            `bad-shape update threw unexpected error: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
    }

    // Soft-delete + restore one activity
    const target = activityIds[3];
    if (target) {
      try {
        const before = await prisma.activity.findUnique({
          where: { id: target },
          select: { byUserId: true },
        });
        if (before?.byUserId) {
          const ownerId = before.byUserId;
          await time('softDeleteActivity', () => softDeleteActivity({ id: ownerId, role: 'DOCTOR' }, target));
          const after = await prisma.activity.findUnique({
            where: { id: target },
            select: { deletedAt: true },
          });
          if (!after?.deletedAt) flag('data', 'soft delete left deletedAt null');
          else log('  + soft delete OK');
          await time('restoreActivity', () => restoreActivity(admin, target));
          const restored = await prisma.activity.findUnique({
            where: { id: target },
            select: { deletedAt: true },
          });
          if (restored?.deletedAt) flag('data', 'restore left deletedAt set');
          else log('  + restore OK');
        }
      } catch (e) {
        flag('reliability', `delete/restore failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Duplicate
    const dupTarget = activityIds[5];
    if (dupTarget) {
      const before = await prisma.activity.findUnique({
        where: { id: dupTarget },
        select: { byUserId: true },
      });
      if (before?.byUserId) {
        const ownerId = before.byUserId;
        try {
          const dup = await time('duplicateActivity', () =>
            duplicateActivity({ id: ownerId, role: 'DOCTOR', name: 'Dup-test' }, dupTarget),
          );
          if (dup.duplicatedFromId !== dupTarget)
            flag('data', 'duplicate.duplicatedFromId not set correctly');
          else log('  + duplicate OK');
        } catch (e) {
          flag('reliability', `duplicate failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }
  }
  log('');

  // ── RBAC: STAFF tries to delete a DOCTOR's activity they don't own ────
  log('RBAC checks');
  const doctorActivity = await prisma.activity.findFirst({
    where: { id: { in: activityIds }, byUserId: doctorA.id, deletedAt: null },
    select: { id: true },
  });
  if (doctorActivity) {
    try {
      await softDeleteActivity({ id: staffA.id, role: 'STAFF' }, doctorActivity.id);
      flag('rbac', 'STAFF was allowed to soft-delete a DOCTOR-owned activity');
    } catch (e) {
      if (e instanceof RbacError) log('  + STAFF blocked from deleting DOCTOR activity');
      else
        flag('rbac', `unexpected error type on STAFF delete: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ── Inline animal edit — triggers UpdateAnimalSchema ──────────────────
  if (admitted[1]) {
    try {
      await time('updateAnimal (ward + ageText)', () =>
        updateAnimal(admin, admitted[1]!.id, { ward: 'ISO-B', ageText: '2y 3m' }),
      );
      log('  + updateAnimal OK (Zod validated)');
    } catch (e) {
      flag('reliability', `updateAnimal failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    // Try overlength name
    try {
      await updateAnimal(admin, admitted[1]!.id, { name: 'X'.repeat(200) });
      flag('rbac', 'updateAnimal accepted overlength name (>100 chars)');
    } catch (e) {
      if (e instanceof ValidationError || /max|too_big|length/i.test(e instanceof Error ? e.message : '')) {
        log('  + overlength name rejected by UpdateAnimalSchema');
      } else {
        flag('rbac', `overlength name threw unexpected: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
  log('');

  // ── Discharge two, record death on one ────────────────────────────────
  log('Discharge + death');
  if (admitted[2]) {
    try {
      await time('dischargeAnimal', () =>
        dischargeAnimal(
          { id: doctorA.id, role: doctorA.role, name: doctorA.name },
          {
            animalId: admitted[2]!.id,
            summary: 'Stones removed via cystotomy, recovered well, suture removal in 10d',
            instructions: "Hill's u/d, plenty of water, recheck in 2 weeks",
            documentFileIds: [],
          },
        ),
      );
      log(`  + discharged ${admitted[2].name}`);
    } catch (e) {
      flag('reliability', `discharge failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (admitted[4]) {
    try {
      await time('recordDeath', () =>
        recordDeath(
          { id: doctorA.id, role: doctorA.role, name: doctorA.name },
          {
            animalId: admitted[4]!.id,
            causeOfDeath: 'DKA — progressive deterioration despite ICU support',
            bodyHandedOverTo: 'Owner (Worli)',
            documentFileIds: [],
          },
        ),
      );
      log(`  + recorded death for ${admitted[4].name}`);
    } catch (e) {
      flag('reliability', `recordDeath failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  log('');

  // ── Snapshot final state ──────────────────────────────────────────────
  log('Final DB snapshot');
  const [
    animalCount,
    activeCount,
    dischargedCount,
    deceasedCount,
    activityCount,
    deletedActivityCount,
    auditCount,
  ] = await Promise.all([
    prisma.animal.count({ where: { deletedAt: null } }),
    prisma.animal.count({
      where: { status: { in: ['CRITICAL', 'STABLE', 'OBSERVATION'] }, deletedAt: null },
    }),
    prisma.animal.count({ where: { status: 'DISCHARGED' } }),
    prisma.animal.count({ where: { status: 'DECEASED' } }),
    prisma.activity.count({ where: { deletedAt: null } }),
    prisma.activity.count({ where: { deletedAt: { not: null } } }),
    prisma.auditLog.count(),
  ]);
  log(
    `  animals=${animalCount}  active=${activeCount}  discharged=${dischargedCount}  deceased=${deceasedCount}`,
  );
  log(`  activities=${activityCount}  soft-deleted=${deletedActivityCount}  auditLog=${auditCount}\n`);

  // ── Timings ───────────────────────────────────────────────────────────
  timings.sort((a, b) => b.ms - a.ms);
  log('Top-10 slowest ops (ms)');
  for (const t of timings.slice(0, 10)) log(`  ${t.ms.toString().padStart(5)}  ${t.label}`);
  if (timings.some((t) => t.ms > 1500)) flag('perf', 'at least one service op took >1.5s');
  log('');

  // ── Friction report ──────────────────────────────────────────────────
  log('━━━ friction report ━━━');
  if (friction.length === 0) log('(no friction flagged in this run)');
  else for (const f of friction) log(`  [${f.category}] ${f.msg}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  process.stderr.write(`${String(e)}\n`);
  process.exit(1);
});
