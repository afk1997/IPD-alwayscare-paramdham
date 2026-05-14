import { z } from 'zod';

export const DOC_CATEGORIES = ['MEDICAL', 'DIAGNOSTICS', 'CONSENT', 'OWNERSHIP', 'DEATH'] as const;
export type DocCategory = (typeof DOC_CATEGORIES)[number];

export const DOC_CATEGORY_LABELS: Record<DocCategory, string> = {
  MEDICAL: 'Medical',
  DIAGNOSTICS: 'Diagnostics',
  CONSENT: 'Consent',
  OWNERSHIP: 'Ownership',
  DEATH: 'Death related',
};

export const DOC_KIND_SUGGESTIONS: Record<DocCategory, readonly string[]> = {
  MEDICAL: ['Past prescription', 'Referral paper', 'Previous treatment history'],
  DIAGNOSTICS: ['X-ray', 'Blood report', 'MRI/CT', 'Sonography'],
  CONSENT: ['Surgery consent', 'High-risk consent', 'Ownership declaration'],
  OWNERSHIP: ['Owner ID', 'Adoption paper'],
  DEATH: ['Death certificate', 'Cause of death', 'Postmortem report', 'Body handover form'],
};

export const CreateDocumentSchema = z.object({
  animalId: z.string().min(1),
  category: z.enum(DOC_CATEGORIES),
  kind: z.string().min(1, 'Document kind required'),
  name: z.string().min(1),
  fileId: z.string().min(1, 'File required'),
});

export type CreateDocumentInput = z.infer<typeof CreateDocumentSchema>;
