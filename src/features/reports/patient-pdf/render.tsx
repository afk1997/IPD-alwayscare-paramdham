import { renderToBuffer } from '@react-pdf/renderer';
import { Report } from './Report';
import { registerReportFonts } from './fonts';
import type { ReportModel } from './model';

export async function renderPatientReportPdf(
  model: ReportModel,
  images: Map<string, Buffer>,
): Promise<Buffer> {
  registerReportFonts();
  return renderToBuffer(<Report model={model} images={images} />);
}
