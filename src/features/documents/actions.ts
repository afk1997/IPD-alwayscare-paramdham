'use server';
import { getCurrentUser } from '@/lib/auth';
import { RbacError } from '@/lib/errors';
import { revalidateTag } from 'next/cache';
import { type CreateDocumentInput, CreateDocumentSchema } from './schema';
import { createDocument } from './service';

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
    revalidateTag(`animal:${parsed.animalId}:documents`);
    return { ok: true, documentId: doc.id };
  } catch (e) {
    if (e instanceof RbacError) return { ok: false, error: e.message };
    if (e && typeof e === 'object' && 'issues' in e) {
      const z = e as { issues?: Array<{ message?: string }> };
      return { ok: false, error: z.issues?.[0]?.message ?? 'Invalid input' };
    }
    throw e;
  }
}
