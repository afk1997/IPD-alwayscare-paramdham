import { prisma } from '../src/lib/prisma';

async function main() {
  const count = await prisma.user.count();
  process.stdout.write(`Connected. User count: ${count}\n`);
  await prisma.$disconnect();
}

main().catch((e) => {
  process.stderr.write(`${String(e)}\n`);
  process.exit(1);
});
