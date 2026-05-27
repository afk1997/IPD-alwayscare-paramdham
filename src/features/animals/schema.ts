import { z } from 'zod';

export const SPECIES = ['Dog', 'Cat', 'Cow', 'Bird', 'Goat', 'Rabbit', 'Other'] as const;
export const STATUSES = ['CRITICAL', 'STABLE', 'OBSERVATION'] as const;
export const TEST_KINDS = ['XRAY', 'USG', 'BLOOD_TEST', 'MRI', 'CT_SCAN', 'SONOGRAPHY'] as const;
export const VACCINATION = ['DONE', 'PARTIAL', 'NONE', 'NA'] as const;
export const GENDER = ['MALE', 'FEMALE', 'UNKNOWN'] as const;

export const CreateAnimalSchema = z.object({
  // basics
  name: z.string().min(1, 'Name is required').max(100),
  species: z.enum(SPECIES),
  breed: z.string().max(80).optional().or(z.literal('')),
  gender: z
    .union([z.enum(GENDER), z.literal(''), z.undefined()])
    .transform((v) => (v === '' || v === undefined ? undefined : v)),
  ageText: z.string().max(40).optional().or(z.literal('')),
  color: z.string().max(120).optional().or(z.literal('')),
  weightKg: z
    .union([z.string(), z.number(), z.undefined(), z.null()])
    .transform((v) => {
      if (v === '' || v === undefined || v === null) return undefined;
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? n : undefined;
    })
    .pipe(z.number().positive().max(2000).optional()),
  vaccination: z.enum(VACCINATION).default('NONE'),
  sterilized: z.coerce.boolean().default(false),
  aggressive: z.coerce.boolean().default(false),

  // rescue
  rescuer: z.string().max(120).optional().or(z.literal('')),
  rescuerPhone: z.string().max(40).optional().or(z.literal('')),
  address: z.string().max(400).optional().or(z.literal('')),
  ngo: z.string().max(120).optional().or(z.literal('')),
  broughtBy: z.string().max(120).optional().or(z.literal('')),

  // medical
  complaint: z.string().max(2000).optional().or(z.literal('')),
  injuryType: z.string().max(120).optional().or(z.literal('')),
  history: z.string().max(2000).optional().or(z.literal('')),
  contagious: z.coerce.boolean().default(false),
  status: z.enum(STATUSES).default('OBSERVATION'),
  ward: z.string().max(40).optional().or(z.literal('')),
  cageId: z.string().cuid().optional().or(z.literal('')),

  // doctor notes
  diagnosis: z.string().max(2000).optional().or(z.literal('')),
  immediateTreatment: z.string().max(2000).optional().or(z.literal('')),
  surgeryRequired: z.string().max(200).optional().or(z.literal('')),
  testsAdvised: z.array(z.enum(TEST_KINDS)).default([]),

  // media
  mediaAssetIds: z.array(z.string()).default([]),
  uploadSessionId: z.string().optional(),
});

export type CreateAnimalInput = z.infer<typeof CreateAnimalSchema>;

// Patch shape for `updateAnimal`. Each field is optional + (where the column
// is nullable) nullable so callers can explicitly clear values. Enforces the
// same max-length / enum constraints as CreateAnimalSchema — without this,
// any signed-in user with `animal.update` could write an arbitrarily long
// name or invalid status string straight to the row. Note: `name` is not
// nullable (the column is `NOT NULL`); `species` is intentionally NOT in
// the patch shape because species changes after admission are nonsensical.
const nullableStr = (max: number) => z.string().max(max).nullable().optional();
export const UpdateAnimalSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  breed: nullableStr(80),
  ageText: nullableStr(40),
  color: nullableStr(120),
  // ACT-12: forms post numeric inputs as strings (`"4.5"`); accept both
  // and coerce. Empty string → null so the user can clear the value.
  weightKg: z
    .union([z.number(), z.string(), z.null()])
    .transform((v) => {
      if (v === null || v === '') return null;
      const n = typeof v === 'number' ? v : Number(v.replace(',', '.'));
      return Number.isFinite(n) ? n : null;
    })
    .refine((v) => v === null || (v > 0 && v <= 2000), 'Weight must be between 0 and 2000 kg')
    .optional(),
  vaccination: z.enum(VACCINATION).optional(),
  sterilized: z.boolean().optional(),
  aggressive: z.boolean().optional(),
  rescuer: nullableStr(120),
  rescuerPhone: nullableStr(40),
  address: nullableStr(400),
  ngo: nullableStr(120),
  broughtBy: nullableStr(120),
  complaint: nullableStr(2000),
  injuryType: nullableStr(120),
  history: nullableStr(2000),
  diagnosis: nullableStr(2000),
  immediateTreatment: nullableStr(2000),
  surgeryRequired: nullableStr(200),
  contagious: z.boolean().optional(),
  status: z.enum(STATUSES).optional(),
  ward: nullableStr(40),
  cageId: z.string().cuid().nullable().optional(),
});
export type UpdateAnimalInput = z.infer<typeof UpdateAnimalSchema>;
