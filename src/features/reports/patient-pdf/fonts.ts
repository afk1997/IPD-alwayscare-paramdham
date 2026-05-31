import { join } from 'node:path';
import { Font } from '@react-pdf/renderer';

const DIR = join(process.cwd(), 'src/features/reports/patient-pdf/fonts');
const ttf = (f: string) => join(DIR, f);

let registered = false;
export function registerReportFonts(): void {
  if (registered) return;
  registered = true;
  Font.register({
    family: 'Noto Sans',
    fonts: [{ src: ttf('NotoSans-Regular.ttf') }, { src: ttf('NotoSans-Bold.ttf'), fontWeight: 700 }],
  });
  Font.register({
    family: 'Noto Serif',
    fonts: [{ src: ttf('NotoSerif-Regular.ttf') }, { src: ttf('NotoSerif-Bold.ttf'), fontWeight: 700 }],
  });
  Font.register({
    family: 'Noto Sans Devanagari',
    fonts: [
      { src: ttf('NotoSansDevanagari-Regular.ttf') },
      { src: ttf('NotoSansDevanagari-Bold.ttf'), fontWeight: 700 },
    ],
  });
  Font.register({
    family: 'Noto Sans Gujarati',
    fonts: [
      { src: ttf('NotoSansGujarati-Regular.ttf') },
      { src: ttf('NotoSansGujarati-Bold.ttf'), fontWeight: 700 },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
}

export function pickFont(text: string | null | undefined): string {
  if (!text) return 'Noto Sans';
  if (/[઀-૿]/.test(text)) return 'Noto Sans Gujarati';
  if (/[ऀ-ॿ]/.test(text)) return 'Noto Sans Devanagari';
  return 'Noto Sans';
}
