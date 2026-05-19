import { z } from 'zod';

export const ACTIVITY_TYPES = [
  'ADMISSION',
  'TREATMENT',
  'ROUND',
  'DIAGNOSTIC',
  'SURGERY',
  'FOOD',
  'BATH',
  'WALK',
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const ROUTES = ['IV', 'IM', 'Oral', 'SC', 'Topical'] as const;
export const INTAKE = ['Fully', 'Partially', 'Refused'] as const;
export const BATH_TYPES = ['Medicated bath', 'Tick treatment', 'Wound cleaning', 'Regular'] as const;
export const TESTS = ['Blood test', 'X-ray', 'Sonography', 'MRI', 'CT', 'USG'] as const;

export const TreatmentData = z.object({
  meds: z
    .array(
      z.object({
        name: z.string().min(1, 'Medicine name required'),
        dose: z.string().min(1, 'Dose required'),
        route: z.enum(ROUTES),
      }),
    )
    .min(1, 'Add at least one medicine'),
});

export const RoundData = z.object({
  temp: z.string().optional(),
  appetite: z.string().optional(),
  hydration: z.string().optional(),
  pain: z.string().optional(),
  wound: z.string().optional(),
  stool: z.string().optional(),
  progress: z.string().optional(),
  notes: z.string().optional(),
});

export const DiagnosticData = z.object({
  tests: z.array(z.enum(TESTS)).min(1, 'Pick at least one test'),
  findings: z.string().optional(),
  interpretation: z.string().optional(),
});

export const SurgeryData = z.object({
  surgeryName: z.string().min(1),
  surgeon: z.string().min(1),
  anesthesia: z.string().optional(),
  duration: z.string().optional(),
  findings: z.string().optional(),
  complications: z.string().optional(),
  postOp: z.string().optional(),
});

export const FoodData = z.object({
  foodType: z.string().min(1),
  qty: z.string().optional(),
  water: z.string().optional(),
  intake: z.enum(INTAKE),
  vomiting: z.coerce.boolean().default(false),
});

export const BathData = z.object({
  bathType: z.enum(BATH_TYPES),
  groomingBy: z.string().optional(),
  remarks: z.string().optional(),
});

export const WalkData = z.object({
  duration: z.string().optional(),
  urination: z.coerce.boolean().default(false),
  stool: z.coerce.boolean().default(false),
  mobility: z.string().optional(),
  assisted: z.coerce.boolean().default(false),
});

export const AdmissionData = z.object({
  summary: z.string().min(1),
});

const Base = z.object({
  animalId: z.string().min(1),
  remarks: z.string().optional(),
  mediaAssetIds: z.array(z.string()).default([]),
  // Optional override for when the activity actually happened — defaults
  // server-side to the Prisma `@default(now())` if omitted.  Accepts any
  // string parsable by `new Date()`; explicitly NOT validated as strict
  // ISO so `<input type="datetime-local">`'s local-time string works.
  occurredAt: z.string().optional(),
});

export const CreateActivitySchema = z.discriminatedUnion('type', [
  Base.extend({ type: z.literal('TREATMENT'), data: TreatmentData }),
  Base.extend({ type: z.literal('ROUND'), data: RoundData }),
  Base.extend({ type: z.literal('DIAGNOSTIC'), data: DiagnosticData }),
  Base.extend({ type: z.literal('SURGERY'), data: SurgeryData }),
  Base.extend({ type: z.literal('FOOD'), data: FoodData }),
  Base.extend({ type: z.literal('BATH'), data: BathData }),
  Base.extend({ type: z.literal('WALK'), data: WalkData }),
  Base.extend({ type: z.literal('ADMISSION'), data: AdmissionData }),
]);

export type CreateActivityInput = z.infer<typeof CreateActivitySchema>;

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  ADMISSION: 'Admission',
  TREATMENT: 'Treatment',
  ROUND: 'Doctor round',
  DIAGNOSTIC: 'Diagnostic',
  SURGERY: 'Surgery',
  FOOD: 'Food & water',
  BATH: 'Bath & grooming',
  WALK: 'Walk / movement',
};
