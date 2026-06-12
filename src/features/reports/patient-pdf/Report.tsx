import { Document, Page } from '@react-pdf/renderer';
import { loadLogo } from './assets';
import type { ReportImage } from './fit';
import type { ReportModel } from './model';
import {
  AdmissionMediaSection,
  DayLog,
  DiagnosticsSection,
  DocumentsList,
  Footer,
  Hero,
  Masthead,
  MedsTable,
  OutcomeSignoff,
  PageHeader,
  RecoveryStrip,
  StatTiles,
  SurgerySection,
} from './sections';
import { s } from './styles';

export function Report({ model, images }: { model: ReportModel; images: Map<string, ReportImage> }) {
  const logo = loadLogo();
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Masthead model={model} logo={logo} />
        <PageHeader model={model} logo={logo} />
        <Hero model={model} images={images} />
        <RecoveryStrip model={model} images={images} />
        <StatTiles model={model} />
        <MedsTable model={model} />
        <SurgerySection model={model} images={images} />
        <DiagnosticsSection model={model} images={images} />
        <AdmissionMediaSection model={model} images={images} />
        <DayLog model={model} images={images} />
        <DocumentsList model={model} />
        <OutcomeSignoff model={model} />
        <Footer model={model} />
      </Page>
    </Document>
  );
}
