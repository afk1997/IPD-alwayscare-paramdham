import { StyleSheet } from '@react-pdf/renderer';

// Brand tokens from the Arham Always Care logo. Minimal palette: ink on
// white, warm-grey secondary text, hairline rules; red appears only in the
// logo, links and the outcome status.
export const BRAND = {
  red: '#8B1A12',
  gold: '#C9A55C',
  hairline: '#E8E2D8',
  cream: '#FDFBF6',
  mat: '#F1ECE2',
  ink: '#221A14',
  muted: '#5D5347',
  soft: '#9A8D76',
};

// Activity-type dots match the app's type colours (unchanged from v1).
export const TYPE_COLOR: Record<string, string> = {
  ADMISSION: '#0E7C7B',
  TREATMENT: '#2563EB',
  ROUND: '#7C3AED',
  DIAGNOSTIC: '#0891B2',
  SURGERY: '#B5471A',
  FOOD: '#15803D',
  BATH: '#0EA5E9',
  WALK: '#A16207',
};

export const OUTCOME_BG = { 'in-care': '#93370D', discharged: '#15803D', deceased: '#B42318' } as const;

export const PAGE_PAD_TOP = 50; // clears the fixed compact header on pages 2+
export const PAGE_PAD_X = 36;

export const s = StyleSheet.create({
  page: {
    paddingTop: PAGE_PAD_TOP,
    paddingBottom: 48,
    paddingHorizontal: PAGE_PAD_X,
    fontFamily: 'Noto Sans',
    fontSize: 9,
    color: BRAND.ink,
  },
  // Page-1 masthead (in flow, fills the padding zone). White, airy, one rule.
  masthead: {
    marginHorizontal: -PAGE_PAD_X,
    marginTop: -PAGE_PAD_TOP,
    paddingTop: 28,
    paddingBottom: 16,
    paddingHorizontal: PAGE_PAD_X,
    marginBottom: 20,
    borderBottomWidth: 0.75,
    borderBottomColor: BRAND.gold,
    alignItems: 'center',
  },
  mastBrandFallback: { fontFamily: 'Noto Serif', fontWeight: 700, fontSize: 20, color: BRAND.red },
  mastKicker: { fontSize: 6.5, letterSpacing: 2.2, color: BRAND.soft, marginTop: 10 },
  // Fixed compact header, pages 2+. Positioning lives on the OUTER fixed
  // View in PageHeader (see comment there).
  pgHead: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: BRAND.gold,
    paddingHorizontal: PAGE_PAD_X,
    paddingVertical: 9,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pgHeadMeta: { fontSize: 6, color: BRAND.soft, letterSpacing: 1 },
  hero: { flexDirection: 'row', gap: 16, marginBottom: 4 },
  heroName: { fontFamily: 'Noto Serif', fontWeight: 700, fontSize: 21 },
  outcomeInline: { marginTop: 5, fontSize: 7.5, fontWeight: 700, letterSpacing: 1 },
  kv: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  kvItem: { width: '50%', flexDirection: 'row', marginBottom: 4, paddingRight: 12 },
  k: { color: BRAND.soft, width: 70, fontSize: 8.5 },
  v: { color: BRAND.ink, flex: 1, fontSize: 8.5 },
  // Floating small-caps section label — no rule, whitespace does the work.
  sec: {
    fontSize: 7.5,
    fontWeight: 700,
    color: BRAND.soft,
    textTransform: 'uppercase',
    letterSpacing: 1.8,
    marginTop: 20,
    marginBottom: 9,
  },
  // Day header: serif date over a hairline, count at the right.
  dayHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottomWidth: 0.5,
    borderBottomColor: BRAND.hairline,
    paddingBottom: 3,
    marginTop: 16,
    marginBottom: 9,
  },
  dayLabel: { fontFamily: 'Noto Serif', fontWeight: 700, fontSize: 10 },
  dayCnt: { fontSize: 6.5, color: BRAND.soft, letterSpacing: 1 },
  // Timeline row: time column · type dot · small-caps type · body.
  row: { flexDirection: 'row', gap: 7, marginBottom: 7, alignItems: 'flex-start' },
  time: { fontSize: 8, color: BRAND.soft, width: 26, marginTop: 0.5 },
  dot: { width: 5, height: 5, borderRadius: 2.5, marginTop: 2.5 },
  typeTag: {
    fontSize: 6.5,
    color: BRAND.soft,
    letterSpacing: 1,
    textTransform: 'uppercase',
    width: 56,
    marginTop: 1,
  },
  entryBody: { flex: 1 },
  summaryMin: { fontSize: 9 },
  detailLine: { fontSize: 8, color: BRAND.muted, marginTop: 2.5 },
  byMin: { fontSize: 6.5, color: BRAND.soft, marginTop: 3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6, alignItems: 'flex-end' },
  gcap: { fontSize: 6.5, color: BRAND.soft, marginTop: 3 },
  imgPh: {
    borderRadius: 3,
    backgroundColor: BRAND.cream,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: BRAND.hairline,
  },
  link: { fontSize: 8, color: BRAND.red, marginTop: 3 },
  outcomeStatus: { fontSize: 9.5, fontWeight: 800, letterSpacing: 1 },
  outcomeLine: { fontSize: 8.5, color: BRAND.muted, marginTop: 4, lineHeight: 1.5 },
  provenance: { fontSize: 6.5, color: BRAND.soft, textAlign: 'center', marginTop: 26 },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: PAGE_PAD_X,
    right: PAGE_PAD_X,
    borderTopWidth: 0.5,
    borderTopColor: BRAND.gold,
    paddingTop: 7,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footText: { fontSize: 6.5, color: BRAND.soft, letterSpacing: 0.4 },
});
