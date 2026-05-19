import { prisma } from '../src/lib/prisma';

async function main() {
  const am = await prisma.animalMedia.deleteMany();
  const acm = await prisma.activityMedia.deleteMany();
  const ma = await prisma.mediaAsset.deleteMany();
  const ac = await prisma.activity.deleteMany();
  const doc = await prisma.document.deleteMany();
  const at = await prisma.animalTest.deleteMany();
  const an = await prisma.animal.deleteMany();
  const aud = await prisma.auditLog.deleteMany();
  process.stdout.write(
    `cleared: animalMedia=${am.count} activityMedia=${acm.count} media=${ma.count} activities=${ac.count} documents=${doc.count} tests=${at.count} animals=${an.count} audit=${aud.count}\n`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  process.stderr.write(`${String(e)}\n`);
  process.exit(1);
});
