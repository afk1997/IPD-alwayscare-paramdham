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
