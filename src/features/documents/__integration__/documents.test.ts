import { createAnimal } from '@/features/animals/service';
import { listAllDocuments } from '@/features/documents/queries';
import { createDocument, restoreDocument, softDeleteDocument } from '@/features/documents/service';
import {
  ADMIN_EMAIL,
  DOCTOR_EMAIL,
  STAFF_EMAIL,
  actorByEmail,
  purgeQa,
  qaName,
} from '@/lib/__integration__/helpers';
import { RbacError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

async function makeAssetAndDoc(
  actor: {
    id: string;
    role: 'STAFF' | 'DOCTOR' | 'ADMIN' | 'SUPER_ADMIN' | 'VIEWER';
    name: string;
  },
  animalId: string,
) {
  // Insert a fully-formed MediaAsset directly so we don't have to go through
  // the Drive resumable upload path in service-layer tests.
  const asset = await prisma.mediaAsset.create({
    data: {
      kind: 'DOC',
      filename: qaName('doc.pdf'),
      originalFilename: qaName('doc.pdf'),
      mimeType: 'application/pdf',
      size: 1024,
      storageKey: `gdrive:${qaName('fakefile')}`,
      status: 'READY',
      uploadedById: actor.id,
    },
  });
  const doc = await prisma.document.create({
    data: {
      animalId,
      category: 'MEDICAL',
      kind: qaName('consent'),
      name: qaName('Consent form'),
      fileId: asset.id,
      uploadedById: actor.id,
    },
  });
  return { asset, doc };
}

describe('documents service — integration vs real DB', () => {
  beforeAll(purgeQa);
  afterAll(purgeQa);

  it('STAFF cannot soft-delete a document (document.delete is DOCTOR+)', async () => {
    const staff = await actorByEmail(STAFF_EMAIL);
    const animal = await createAnimal(staff, {
      name: qaName('DocAnimal1'),
      species: 'Dog',
      vaccination: 'NONE',
      sterilized: false,
      aggressive: false,
      status: 'OBSERVATION',
      contagious: false,
      testsAdvised: [],
      mediaAssetIds: [],
    });
    const { doc } = await makeAssetAndDoc(staff, animal.id);
    await expect(softDeleteDocument(staff, doc.id)).rejects.toBeInstanceOf(RbacError);
  });

  it('DOCTOR can soft-delete then ADMIN can restore (document.restore is ADMIN)', async () => {
    const doctor = await actorByEmail(DOCTOR_EMAIL);
    const admin = await actorByEmail(ADMIN_EMAIL);
    const animal = await createAnimal(doctor, {
      name: qaName('DocAnimal2'),
      species: 'Dog',
      vaccination: 'NONE',
      sterilized: false,
      aggressive: false,
      status: 'OBSERVATION',
      contagious: false,
      testsAdvised: [],
      mediaAssetIds: [],
    });
    const { doc } = await makeAssetAndDoc(doctor, animal.id);
    const deleted = await softDeleteDocument(doctor, doc.id);
    expect(deleted.deletedAt).not.toBeNull();
    // DOCTOR cannot restore.
    await expect(restoreDocument(doctor, doc.id)).rejects.toBeInstanceOf(RbacError);
    // ADMIN can.
    const restored = await restoreDocument(admin, doc.id);
    expect(restored.deletedAt).toBeNull();
    const audits = await prisma.auditLog.findMany({
      where: { entityType: 'Document', entityId: doc.id, action: { in: ['delete', 'restore'] } },
      orderBy: { createdAt: 'asc' },
    });
    expect(audits.map((a) => a.action)).toEqual(['delete', 'restore']);
  });

  it('listAllDocuments requires ADMIN (RBAC-5)', async () => {
    const staff = await actorByEmail(STAFF_EMAIL);
    const doctor = await actorByEmail(DOCTOR_EMAIL);
    const admin = await actorByEmail(ADMIN_EMAIL);
    await expect(listAllDocuments(staff, {})).rejects.toBeInstanceOf(RbacError);
    await expect(listAllDocuments(doctor, {})).rejects.toBeInstanceOf(RbacError);
    const rows = await listAllDocuments(admin, { limit: 5 });
    expect(Array.isArray(rows)).toBe(true);
  });

  it('listAllDocuments excludes docs whose animal is soft-deleted (SD-4)', async () => {
    const admin = await actorByEmail(ADMIN_EMAIL);
    const animal = await createAnimal(admin, {
      name: qaName('SoftDelAnimalForDoc'),
      species: 'Dog',
      vaccination: 'NONE',
      sterilized: false,
      aggressive: false,
      status: 'OBSERVATION',
      contagious: false,
      testsAdvised: [],
      mediaAssetIds: [],
    });
    const { doc } = await makeAssetAndDoc(admin, animal.id);
    // Soft-delete the parent animal — doc itself stays live.
    await prisma.animal.update({ where: { id: animal.id }, data: { deletedAt: new Date() } });
    const rows = await listAllDocuments(admin, { limit: 200 });
    expect(rows.find((r) => r.id === doc.id)).toBeUndefined();
  });
});

describe('closed-case lock — documents', () => {
  it('DOCTOR cannot add a document to a DECEASED animal', async () => {
    const doctor = await actorByEmail(DOCTOR_EMAIL);
    const animal = await prisma.animal.create({
      data: {
        name: qaName('closed-doc'),
        species: 'Dog',
        status: 'DECEASED',
        deceasedAt: new Date(),
        vaccination: 'NONE',
        createdById: doctor.id,
      },
    });
    const asset = await prisma.mediaAsset.create({
      data: {
        kind: 'DOC',
        filename: `${qaName('f')}.pdf`,
        mimeType: 'application/pdf',
        size: 10,
        storageKey: `local:${qaName('k')}.pdf`,
        status: 'READY',
        uploadedById: doctor.id,
      },
    });
    await expect(
      createDocument(doctor, {
        animalId: animal.id,
        category: 'MEDICAL',
        kind: 'Report',
        name: qaName('doc'),
        fileId: asset.id,
      }),
    ).rejects.toBeInstanceOf(RbacError);
  });
});
