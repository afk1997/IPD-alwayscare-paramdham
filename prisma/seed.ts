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
  for (const u of SEED_USERS) {
    const passwordHash = await bcrypt.hash(u.password, 12);
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, active: true },
      create: {
        email: u.email,
        passwordHash,
        name: u.name,
        role: u.role,
        active: true,
      },
    });
  }
  process.stdout.write(`Seeded ${SEED_USERS.length} users.\n`);
}

main()
  .catch((e) => {
    process.stderr.write(`${String(e)}\n`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
