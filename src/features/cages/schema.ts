import { z } from 'zod';

const cageName = z.string().trim().min(1, 'Name is required').max(40);

export const CreateCageSchema = z.object({ name: cageName });
export const RenameCageSchema = z.object({ id: z.string().cuid(), name: cageName });
export const DeleteCageSchema = z.object({ id: z.string().cuid() });

export type CreateCageInput = z.infer<typeof CreateCageSchema>;
export type RenameCageInput = z.infer<typeof RenameCageSchema>;
export type DeleteCageInput = z.infer<typeof DeleteCageSchema>;
