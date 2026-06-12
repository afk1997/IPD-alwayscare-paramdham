// Pages-Router API route (NOT an App-Router route handler) on purpose:
// @react-pdf/renderer's reconciler can't render elements created under Next's
// App-Router `react-server` condition (React error #31). A Pages API route runs
// in the plain Node/React context where react-pdf works.
import { collectImageAssets, getPatientReportData } from '@/features/reports/patient-pdf/data';
import { loadReportImages } from '@/features/reports/patient-pdf/images';
import { renderPatientReportPdf } from '@/features/reports/patient-pdf/render';
import { RbacError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { assertCan } from '@/lib/rbac';
import type { NextApiRequest, NextApiResponse } from 'next';

// Read the NextAuth session without importing next-auth into this Pages route
// (its server module pulls in App-Router-only `next/server` and breaks here).
// The existing [...nextauth] handler serves the session JSON; we forward the
// request's cookie to it.
async function sessionUserId(req: NextApiRequest): Promise<string | null> {
  const proto = req.headers['x-forwarded-proto'];
  const scheme = (Array.isArray(proto) ? proto[0] : proto) ?? 'http';
  const host = req.headers.host ?? 'localhost:3000';
  const r = await fetch(`${scheme}://${host}/api/auth/session`, {
    headers: { cookie: req.headers.cookie ?? '' },
  });
  if (!r.ok) return null;
  const session = (await r.json()) as { user?: { id?: string } };
  return session.user?.id ?? null;
}

// Reports can exceed the 4 MB default response cap; allow large PDFs. 120s for
// image-heavy stays.
export const config = { api: { responseLimit: false }, maxDuration: 120 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const userId = await sessionUserId(req);
  if (!userId) return res.status(401).json({ error: 'unauthenticated' });
  // DB re-check (active + authoritative role), mirroring getCurrentUser.
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, active: true, name: true },
  });
  if (!dbUser || !dbUser.active) return res.status(401).json({ error: 'unauthenticated' });
  try {
    assertCan({ id: dbUser.id, role: dbUser.role }, 'report.generate');
  } catch (e) {
    if (e instanceof RbacError) return res.status(403).json({ error: e.message });
    throw e;
  }

  const id = String(req.query.id);
  const from = typeof req.query.from === 'string' ? req.query.from : undefined;
  const to = typeof req.query.to === 'string' ? req.query.to : undefined;
  const range = from && to ? { from, to } : undefined;

  const model = await getPatientReportData(id, dbUser.name, range);
  if (!model) return res.status(404).json({ error: 'not found' });

  const images = await loadReportImages(collectImageAssets(model));
  const pdf = await renderPatientReportPdf(model, images);

  const safe =
    `${model.patient.name}-${model.patient.species}`.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') ||
    'patient';
  const date = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  res.setHeader('content-type', 'application/pdf');
  res.setHeader('content-disposition', `attachment; filename="${safe}-report-${date}.pdf"`);
  res.setHeader('cache-control', 'no-store');
  res.send(pdf);
}
