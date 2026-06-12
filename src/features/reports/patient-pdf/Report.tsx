import { Document, Page } from '@react-pdf/renderer';
import { loadLogo } from './assets';
import type { ReportImage } from './fit';
import type { ReportModel } from './model';
import {
  AdmissionMediaSection,
  DayLog,
  DocumentsList,
  Footer,
  Hero,
  Masthead,
  MedicalIntake,
  OutcomeSignoff,
  PageHeader,
  RescueIntake,
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
        <MedicalIntake model={model} />
        <RescueIntake model={model} />
        <AdmissionMediaSection model={model} images={images} />
        <DayLog model={model} images={images} />
        <DocumentsList model={model} />
        <OutcomeSignoff model={model} />
        <Footer model={model} />
      </Page>
    </Document>
  );
}
