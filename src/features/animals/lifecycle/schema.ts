import { z } from 'zod';

export const DischargeSchema = z.object({
  animalId: z.string().min(1),
  summary: z.string().min(1, 'Summary required'),
  instructions: z.string().optional(),
  // File IDs uploaded via MediaUploader before submit (consent docs,
  // discharge summary scans, etc.).  Service creates a Document record
  // per file with category=CONSENT.
  documentFileIds: z.array(z.string()).default([]),
});

export type DischargeInput = z.infer<typeof DischargeSchema>;

export const DeathSchema = z.object({
  animalId: z.string().min(1),
  causeOfDeath: z.string().min(1, 'Cause of death required'),
  bodyHandedOverTo: z.string().optional(),
  postmortemFileId: z.string().optional(),
});

export type DeathInput = z.infer<typeof DeathSchema>;
