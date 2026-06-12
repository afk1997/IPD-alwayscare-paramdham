import { renderToBuffer } from '@react-pdf/renderer';
import { Report } from './Report';
import type { ReportImage } from './fit';
import { registerReportFonts } from './fonts';
import type { ReportModel } from './model';

export async function renderPatientReportPdf(
  model: ReportModel,
  images: Map<string, ReportImage>,
): Promise<Buffer> {
  registerReportFonts();
  return renderToBuffer(<Report model={model} images={images} />);
}
