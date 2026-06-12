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

  // A small REAL JPEG, generated with sharp (already a prod dependency).
  // The previous hand-rolled "smallest valid JPEG" byte array was truncated:
  // browsers tolerated it, but libvips/sharp refuses it ("premature end of
  // JPEG image"), so the patient-report PDF — which decodes media through
  // sharp — rendered "image unavailable" for this fixture.
  const { default: sharp } = await import('sharp');
  const pixelJpeg = await sharp({
    create: { width: 96, height: 64, channels: 3, background: { r: 193, g: 122, b: 71 } },
  })
    .jpeg({ quality: 80 })
    .toBuffer();

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
