import { join } from 'node:path';
import { Font } from '@react-pdf/renderer';

const DIR = join(process.cwd(), 'src/features/reports/patient-pdf/fonts');
const ttf = (f: string) => join(DIR, f);

const REPORT_FAMILIES = ['Noto Sans', 'Noto Serif', 'Noto Sans Devanagari', 'Noto Sans Gujarati'];

// Called before EVERY render, and deliberately NOT guarded by a "registered"
// flag: react-pdf's font store keeps the parsed fontkit instance on the
// registration across renderToBuffer calls, and embedding/subsetting one
// document poisons that shared instance for the NEXT one — glyphs get dropped
// (observed: the leading '0' of '0.2 mg/kg' vanished from the meds table) and
// the hyphenation callback is ignored (mid-word 'w/eight-bearing' breaks).
//
// The cache bust is surgical: drop ONLY our families from the store and
// re-register them, handing each render brand-new font objects. The store's
// built-in seeding must stay untouched — Font.clear() also wipes the standard
// PDF families, and the layout engine's universal 'Helvetica' fallback then
// resolves to a never-loaded source: any glyph that misses our fonts crashes
// the render with "Cannot read properties of null (reading 'unitsPerEm')"
// (the store's constructor eagerly loads Helvetica precisely so that fallback
// is always usable; Font.reset() breaks the same invariant by nulling it).
// The cost is re-parsing 8 local TTFs per report, a few ms on a route that
// already renders a whole PDF.
export function registerReportFonts(): void {
  const families = Font.getRegisteredFonts() as unknown as Record<string, unknown>;
  for (const name of REPORT_FAMILIES) delete families[name];

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
