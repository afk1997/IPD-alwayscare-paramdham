import { collectImageAssets, getPatientReportData } from '@/features/reports/patient-pdf/data';
import { loadReportImages } from '@/features/reports/patient-pdf/images';
import { renderPatientReportPdf } from '@/features/reports/patient-pdf/render';
import { getCurrentUser } from '@/lib/auth';
import { RbacError } from '@/lib/errors';
import { assertCan } from '@/lib/rbac';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs'; // react-pdf + sharp need Node, not edge
export const maxDuration = 120; // image-heavy reports
export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  try {
    assertCan({ id: user.id, role: user.role }, 'report.generate');
  } catch (e) {
    if (e instanceof RbacError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }

  const sp = new URL(req.url).searchParams;
  const from = sp.get('from');
  const to = sp.get('to');
  const range = from && to ? { from, to } : undefined;

  const model = await getPatientReportData(id, range);
  if (!model) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const images = await loadReportImages(collectImageAssets(model));
  const pdf = await renderPatientReportPdf(model, images);

  const safe =
    `${model.patient.name}-${model.patient.species}`.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') ||
    'patient';
  const date = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${safe}-report-${date}.pdf"`,
      'cache-control': 'no-store',
    },
  });
}
