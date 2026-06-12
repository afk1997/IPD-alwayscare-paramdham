/**
 * Render a patient-report PDF straight through the feature pipeline —
 * read-only DB access, no HTTP route / login involved.
 *
 *   pnpm exec dotenv -e <env file> -- pnpm exec tsx --tsconfig scripts/tsconfig.tsx-cli.json \
 *     scripts/generate-report-pdf.ts <name-or-id> [out.pdf]
 *
 * (--tsconfig: the repo tsconfig uses Next's `jsx: preserve`; the CLI variant
 * switches to `react-jsx` so react-pdf's JSX renders outside Next.)
 *
 * Matches the most recently admitted, non-deleted animal whose id equals or
 * name contains the query (case-insensitive).
 */
import { writeFileSync } from 'node:fs';
import { collectImageAssets, getPatientReportData } from '@/features/reports/patient-pdf/data';
import { loadReportImages } from '@/features/reports/patient-pdf/images';
import { renderPatientReportPdf } from '@/features/reports/patient-pdf/render';
import { prisma } from '@/lib/prisma';

async function main() {
  const q = process.argv[2];
  if (!q) throw new Error('usage: tsx scripts/generate-report-pdf.ts <animal name or id> [out.pdf]');
  const out = process.argv[3] ?? '/tmp/report.pdf';

  const animal = await prisma.animal.findFirst({
    where: { deletedAt: null, OR: [{ id: q }, { name: { contains: q, mode: 'insensitive' } }] },
    select: { id: true, name: true },
    orderBy: { admittedAt: 'desc' },
  });
  if (!animal) throw new Error(`no animal matching "${q}"`);
  process.stdout.write(`rendering report for ${animal.name} (${animal.id})\n`);

  const model = await getPatientReportData(animal.id, 'Preview (CLI)');
  if (!model) throw new Error('no report data');
  const images = await loadReportImages(collectImageAssets(model));
  const pdf = await renderPatientReportPdf(model, images);
  writeFileSync(out, pdf);
  process.stdout.write(`wrote ${out} (${pdf.length} bytes, ${images.size} images)\n`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
