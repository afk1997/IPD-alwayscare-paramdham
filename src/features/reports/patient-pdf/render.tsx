import { renderToBuffer } from '@react-pdf/renderer';
import { Report } from './Report';
import type { ReportImage } from './fit';
import { registerReportFonts } from './fonts';
import type { ReportModel } from './model';

// react-pdf's font store is process-global and registerReportFonts() mutates
// it per render (see fonts.ts); a concurrent render on the same warm instance
// could observe a half-swapped store mid-layout. Reports are heavyweight and
// rare, so serialize render+registration as one atomic job per process.
let queue: Promise<unknown> = Promise.resolve();

export function renderPatientReportPdf(
  model: ReportModel,
  images: Map<string, ReportImage>,
): Promise<Buffer> {
  const job = queue.then(() => {
    registerReportFonts();
    return renderToBuffer(<Report model={model} images={images} />);
  });
  queue = job.catch(() => undefined);
  return job;
}
