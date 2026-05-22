'use server';
import { getCurrentUser } from '@/lib/auth';
import { NotFoundError, RbacError, ValidationError } from '@/lib/errors';
import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { type CreateDocumentInput, CreateDocumentSchema } from './schema';
import { createDocument, softDeleteDocument } from './service';

async function requireActor() {
  const user = await getCurrentUser();
  if (!user) throw new RbacError('not authenticated');
  return { id: user.id, role: user.role };
}

export interface DocumentActionResult {
  ok: boolean;
  documentId?: string;
  error?: string;
}

export async function createDocumentAction(input: CreateDocumentInput): Promise<DocumentActionResult> {
  try {
    const actor = await requireActor();
    const parsed = CreateDocumentSchema.parse(input);
    const doc = await createDocument(actor, parsed);
    revalidateTag('documents');
    revalidatePath(`/patients/${parsed.animalId}`);
    return { ok: true, documentId: doc.id };
  } catch (e) {
    if (e instanceof RbacError) return { ok: false, error: e.message };
    if (e instanceof NotFoundError) return { ok: false, error: 'Patient not found' };
    if (e instanceof ValidationError) return { ok: false, error: e.message };
    if (e && typeof e === 'object' && 'issues' in e) {
      const z = e as { issues?: Array<{ message?: string }> };
      return { ok: false, error: z.issues?.[0]?.message ?? 'Invalid input' };
    }
    console.error('[documents/actions] create', e instanceof Error ? e.message : 'unknown');
    return { ok: false, error: 'Could not create document' };
  }
}

const IdSchema = z.string().cuid();

export async function deleteDocumentAction(documentId: string): Promise<DocumentActionResult> {
  try {
    const actor = await requireActor();
    const id = IdSchema.safeParse(documentId);
    if (!id.success) return { ok: false, error: 'Invalid document id' };
    const doc = await softDeleteDocument(actor, id.data);
    revalidateTag('documents');
    revalidatePath(`/patients/${doc.animalId}`);
    return { ok: true };
  } catch (e) {
    if (e instanceof RbacError) return { ok: false, error: e.message };
    if (e instanceof NotFoundError) return { ok: false, error: 'Document not found' };
    console.error('[documents/actions] delete', e instanceof Error ? e.message : 'unknown');
    return { ok: false, error: 'Could not delete document' };
  }
}
