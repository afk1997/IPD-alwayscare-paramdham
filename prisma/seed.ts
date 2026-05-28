import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SEED_USERS = [
  { email: 'admin@arham.care', name: 'Asha (Reception)', role: Role.ADMIN, password: 'admin1234' },
  { email: 'mehta@arham.care', name: 'Dr. Mehta', role: Role.DOCTOR, password: 'doctor1234' },
  { email: 'iyer@arham.care', name: 'Dr. Iyer', role: Role.DOCTOR, password: 'doctor1234' },
  { email: 'sahil@arham.care', name: 'Sahil (paramedic)', role: Role.STAFF, password: 'staff1234' },
  { email: 'pooja@arham.care', name: 'Nurse Pooja', role: Role.STAFF, password: 'staff1234' },
  { email: 'anu@arham.care', name: 'Nurse Anu', role: Role.STAFF, password: 'staff1234' },
];

async function main() {
  // DB-2: refuse to run against a production database unless the operator
  // has explicitly opted in. Without this, a stray `pnpm db:seed` against
  // a prod DATABASE_URL would (re)create the well-known dev accounts with
  // their published passwords.
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PROD_SEED !== 'yes') {
    process.stderr.write(
      'Refusing to seed in NODE_ENV=production. Set ALLOW_PROD_SEED=yes only when initialising a fresh prod DB.\n',
    );
    process.exit(1);
  }
  for (const u of SEED_USERS) {
    const passwordHash = await bcrypt.hash(u.password, 12);
    await prisma.user.upsert({
      where: { email: u.email.toLowerCase() },
      update: { name: u.name, role: u.role, active: true },
      create: {
        email: u.email.toLowerCase(),
        passwordHash,
        name: u.name,
        role: u.role,
        active: true,
      },
    });
  }
  process.stdout.write(`Seeded ${SEED_USERS.length} users.\n`);
}

// E2E fixture: seed one admitted animal + one READY media asset so
// the signed-media + optimistic-mutations e2e specs have real data
// to assert against.  Only runs when STORAGE_DRIVER=local (CI uses
// local; production must not seed fake patients).
async function seedE2eFixture() {
  if (process.env.STORAGE_DRIVER !== 'local') {
    process.stdout.write('[seed] skipping e2e fixture (STORAGE_DRIVER != local)\n');
    return;
  }
  const adminUser = await prisma.user.findUnique({ where: { email: 'admin@arham.care' } });
  if (!adminUser) {
    process.stdout.write('[seed] skipping e2e fixture (admin user missing)\n');
    return;
  }

  // Idempotent — check for existing fixture before creating
  const existing = await prisma.animal.findFirst({ where: { name: 'E2E-Fixture' } });
  if (existing) {
    process.stdout.write('[seed] e2e fixture animal already exists, skipping\n');
    return;
  }

  // 1x1 JPEG (smallest valid JPEG: ~145 bytes)
  const pixelJpeg = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00,
    0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07,
    0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12, 0x13, 0x0f, 0x14,
    0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c,
    0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32, 0x3c,
    0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00,
    0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff,
    0xc4, 0x00, 0xb5, 0x10, 0x00, 0x02, 0x01, 0x03, 0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00,
    0x00, 0x01, 0x7d, 0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06, 0x13, 0x51,
    0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08, 0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1,
    0xf0, 0x24, 0x33, 0x62, 0x72, 0x82, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xfb,
    0xd0, 0xff, 0xd9,
  ]);

  const uploadDir = process.env.LOCAL_UPLOAD_DIR ?? './uploads';
  const fixtureRelPath = 'e2e-fixture/test-pixel.jpg';
  const fixtureAbs = path.join(uploadDir, fixtureRelPath);
  fs.mkdirSync(path.dirname(fixtureAbs), { recursive: true });
  fs.writeFileSync(fixtureAbs, pixelJpeg);

  // Create asset + animal + AnimalMedia link + one activity
  const asset = await prisma.mediaAsset.create({
    data: {
      kind: 'PHOTO',
      filename: 'test-pixel.jpg',
      mimeType: 'image/jpeg',
      size: pixelJpeg.length,
      storageKey: `local:${fixtureRelPath}`,
      status: 'READY',
      uploadedById: adminUser.id,
    },
  });

  const animal = await prisma.animal.create({
    data: {
      name: 'E2E-Fixture',
      species: 'Dog',
      breed: 'Indian',
      gender: 'UNKNOWN',
      vaccination: 'NONE',
      status: 'STABLE',
      createdById: adminUser.id,
      media: { create: { assetId: asset.id, order: 0 } },
    },
  });

  await prisma.activity.create({
    data: {
      animalId: animal.id,
      type: 'FOOD',
      byUserId: adminUser.id,
      byName: adminUser.name,
      data: { foodType: 'kibble', qty: '100g' },
    },
  });

  process.stdout.write(`[seed] e2e fixture created: animal ${animal.id} + asset ${asset.id}\n`);
}

main()
  .then(() => seedE2eFixture())
  .catch((e) => {
    process.stderr.write(`${String(e)}\n`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
