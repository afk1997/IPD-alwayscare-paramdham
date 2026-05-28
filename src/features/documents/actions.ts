'use server';
import { getCurrentUser } from '@/lib/auth';
import { NotFoundError, RbacError, ValidationError } from '@/lib/errors';
import { signMediaUrl } from '@/lib/media-sign';
import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import type { DocCategory } from './schema';
import { type CreateDocumentInput, CreateDocumentSchema } from './schema';
import { createDocument, softDeleteDocument } from './service';

async function requireActor() {
  const user = await getCurrentUser();
  if (!user) throw new RbacError('not authenticated');
  return { id: user.id, role: user.role };
}

export interface DocumentRow {
  id: string;
  category: DocCategory;
  kind: string;
  name: string;
  createdAt: string;
  uploadedBy: { name: string };
  fileUrl: string | null;
  file: { id: string; kind: string; filename: string } | null;
}

export interface DocumentActionResult {
  ok: boolean;
  documentId?: string;
  document?: DocumentRow;
  error?: string;
}

export async function createDocumentAction(input: CreateDocumentInput): Promise<DocumentActionResult> {
  try {
    const actor = await requireActor();
    const parsed = CreateDocumentSchema.parse(input);
    const created = await createDocument(actor, parsed);
    revalidateTag('documents');
    revalidatePath(`/patients/${parsed.animalId}`);
    return {
      ok: true,
      documentId: created.id,
      document: {
        id: created.id,
        category: created.category as DocCategory,
        kind: created.kind,
        name: created.name,
        createdAt: created.createdAt.toISOString(),
        uploadedBy: { name: created.uploadedBy.name },
        fileUrl: created.file ? signMediaUrl(created.file.id) : null,
        file: created.file
          ? { id: created.file.id, kind: created.file.kind, filename: created.file.filename }
          : null,
      },
    };
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
