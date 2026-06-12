import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { ReportImage } from './fit';
import { pickFont } from './fonts';
import type { RawMedia, ReportEntry, ReportModel } from './model';

const C = {
  teal: '#0E7C7B',
  ink: '#0F1B26',
  muted: '#5B6B7A',
  soft: '#90A0B0',
  line: '#E6ECF1',
  bg: '#F4F7F9',
};
const TYPE_COLOR: Record<string, string> = {
  ADMISSION: '#0E7C7B',
  TREATMENT: '#2563EB',
  ROUND: '#7C3AED',
  DIAGNOSTIC: '#0891B2',
  SURGERY: '#B5471A',
  FOOD: '#15803D',
  BATH: '#0EA5E9',
  WALK: '#A16207',
};

const s = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 46,
    paddingHorizontal: 30,
    fontFamily: 'Noto Sans',
    fontSize: 9,
    color: C.ink,
  },
  band: {
    backgroundColor: C.teal,
    marginHorizontal: -30,
    marginTop: -28,
    paddingHorizontal: 30,
    paddingVertical: 16,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brand: { fontFamily: 'Noto Serif', fontWeight: 700, fontSize: 16, color: '#fff' },
  bandSub: { color: '#cdeceb', fontSize: 7, marginTop: 2 },
  bandMeta: { color: '#e8f6f5', fontSize: 7, textAlign: 'right' },
  hero: { flexDirection: 'row', gap: 14, marginBottom: 14 },
  avatar: { width: 96, height: 96, borderRadius: 8, objectFit: 'cover', border: `1 solid ${C.line}` },
  avatarPh: {
    width: 96,
    height: 96,
    borderRadius: 8,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroName: { fontFamily: 'Noto Serif', fontWeight: 700, fontSize: 18 },
  pill: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 8,
    fontSize: 8,
    fontWeight: 700,
  },
  kv: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  kvItem: { width: '50%', flexDirection: 'row', marginBottom: 3, paddingRight: 10 },
  k: { color: C.soft, width: 64 },
  v: { color: C.ink, fontWeight: 700, flex: 1 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 14 },
  tile: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 9,
    backgroundColor: C.bg,
    minWidth: 78,
  },
  tileN: { fontSize: 15, fontWeight: 700 },
  tileL: { fontSize: 7, color: C.soft, marginTop: 3, textTransform: 'uppercase' },
  sec: {
    fontSize: 9,
    fontWeight: 700,
    color: C.muted,
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 7,
  },
  table: { borderWidth: 1, borderColor: C.line, borderRadius: 6 },
  trH: { flexDirection: 'row', backgroundColor: C.bg },
  tr: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.line },
  th: { fontSize: 7, color: C.muted, textTransform: 'uppercase', padding: 5, flex: 1 },
  td: { fontSize: 8, padding: 5, flex: 1 },
  dayBand: {
    flexDirection: 'row',
    backgroundColor: C.bg,
    borderRadius: 7,
    paddingVertical: 5,
    paddingHorizontal: 9,
    marginTop: 14,
    marginBottom: 8,
  },
  dayLabel: { fontSize: 9, fontWeight: 700, flex: 1 },
  dayCnt: { fontSize: 8, color: C.soft },
  card: {
    flexDirection: 'row',
    gap: 10,
    borderWidth: 1,
    borderColor: C.line,
    borderLeftWidth: 3,
    borderRadius: 8,
    padding: 9,
    marginBottom: 7,
  },
  crow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: C.line,
    borderLeftWidth: 3,
    borderRadius: 7,
    paddingVertical: 5,
    paddingHorizontal: 9,
    marginBottom: 5,
  },
  chip: { fontSize: 8, fontWeight: 700, paddingVertical: 2, paddingHorizontal: 7, borderRadius: 8 },
  time: { fontSize: 8, color: C.muted, fontWeight: 700 },
  summary: { fontSize: 10, fontWeight: 700, marginTop: 5 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 5 },
  dpill: {
    fontSize: 8,
    color: C.muted,
    backgroundColor: '#eef2f5',
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  dline: { fontSize: 8.5, color: C.muted, marginTop: 3 },
  by: { fontSize: 7.5, color: C.soft, marginTop: 6 },
  primary: { width: 150, height: 112, borderRadius: 7, objectFit: 'cover', border: `1 solid ${C.line}` },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 7 },
  gcell: { width: 150 },
  gimg: { width: 150, height: 108, borderRadius: 7, objectFit: 'cover', border: `1 solid ${C.line}` },
  gcap: { fontSize: 6.5, color: C.soft, marginTop: 2 },
  imgPh: {
    borderRadius: 7,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
    border: `1 solid ${C.line}`,
  },
  link: { fontSize: 8, color: C.teal, marginTop: 4 },
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 30,
    right: 30,
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footText: { fontSize: 7.5, color: C.soft },
});

const OUTCOME_BG = { 'in-care': '#93370d', discharged: '#15803D', deceased: '#B42318' } as const;

type PdfStyle = NonNullable<React.ComponentProps<typeof View>['style']>;

function T({ children, style, dyn }: { children: React.ReactNode; style?: PdfStyle; dyn?: string | null }) {
  const family = dyn ? pickFont(dyn) : undefined;
  return (
    <Text
      style={[...(Array.isArray(style) ? style : style ? [style] : []), family ? { fontFamily: family } : {}]}
    >
      {children}
    </Text>
  );
}

function ImgOrPlaceholder({
  id,
  images,
  w,
  h,
  style,
}: { id: string; images: Map<string, ReportImage>; w: number; h: number; style?: PdfStyle }) {
  const img = images.get(id);
  if (img)
    return (
      <Image
        src={{ data: img.data, format: 'jpg' }}
        style={[{ width: w, height: h }, ...(Array.isArray(style) ? style : style ? [style] : [])]}
      />
    );
  return (
    <View
      style={[s.imgPh, { width: w, height: h }, ...(Array.isArray(style) ? style : style ? [style] : [])]}
    >
      <Text style={{ fontSize: 7, color: C.soft }}>image unavailable</Text>
    </View>
  );
}

function detailPill(text: string, i: number) {
  // short detail → pill; long (notes/remarks/findings/etc.) → line
  return text.length <= 26 &&
    !/^(Notes|Remarks|Findings|Interpretation|Complications|Post-op|Bath notes|Summary):/.test(text) ? (
    <T key={i} style={s.dpill}>
      {text}
    </T>
  ) : null;
}

function ActivityBlock({ e, images }: { e: ReportEntry; images: Map<string, ReportImage> }) {
  const color = TYPE_COLOR[e.type] ?? C.muted;
  const label = e.type[0] + e.type.slice(1).toLowerCase();
  const pills = e.details.map((d, i) => detailPill(d, i)).filter(Boolean);
  const lines = e.details.filter(
    (d) =>
      d.length > 26 ||
      /^(Notes|Remarks|Findings|Interpretation|Complications|Post-op|Bath notes|Summary):/.test(d),
  );
  const head = (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={[s.chip, { backgroundColor: `${color}22`, color }]}>{label}</Text>
      <Text style={s.time}>{e.time}</Text>
    </View>
  );
  const bodyText = (
    <>
      <T style={s.summary} dyn={e.summary}>
        {e.summary}
      </T>
      {pills.length > 0 && <View style={s.pills}>{pills}</View>}
      {lines.map((l) => (
        <T key={l} style={s.dline} dyn={l}>
          {l}
        </T>
      ))}
      {e.links.map((m) => (
        <T key={m.assetId} style={s.link} dyn={m.filename}>
          {m.kind === 'VIDEO' ? 'Video: ' : 'Doc: '}
          {m.filename}
        </T>
      ))}
      <T style={s.by} dyn={e.byName}>
        by {e.byName}
        {e.edited ? ' · edited' : ''}
      </T>
    </>
  );

  if (e.stills.length === 0) {
    return (
      <View style={[s.crow, { borderLeftColor: color }]} wrap={false}>
        <Text style={s.time}>{e.time}</Text>
        <Text style={[s.chip, { backgroundColor: `${color}22`, color }]}>{label}</Text>
        <T style={{ flex: 1, fontSize: 9 }} dyn={e.summary}>
          {e.summary}
        </T>
      </View>
    );
  }
  if (e.stills.length === 1) {
    return (
      <View style={[s.card, { borderLeftColor: color }]} wrap={false}>
        <View>
          <ImgOrPlaceholder
            id={e.stills[0]?.assetId ?? ''}
            images={images}
            w={150}
            h={112}
            style={s.primary}
          />
          <Text style={s.gcap}>
            {e.time} · {e.stills[0]?.label || 'Photo'}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          {head}
          {bodyText}
        </View>
      </View>
    );
  }
  return (
    <View style={[s.card, { borderLeftColor: color, flexDirection: 'column' }]}>
      {head}
      {bodyText}
      <View style={s.grid}>
        {e.stills.map((m) => (
          <View key={m.assetId} style={s.gcell}>
            <ImgOrPlaceholder id={m.assetId} images={images} w={150} h={108} style={s.gimg} />
            <Text style={s.gcap}>
              {e.time} · {m.label || (m.kind === 'XRAY' ? 'X-ray' : 'Photo')}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function Report({ model, images }: { model: ReportModel; images: Map<string, ReportImage> }) {
  const p = model.patient;
  const kv = (label: string, val: string | null) =>
    val ? (
      <View style={s.kvItem}>
        <Text style={s.k}>{label}</Text>
        <T style={s.v} dyn={val}>
          {val}
        </T>
      </View>
    ) : null;
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.band}>
          <View>
            <Text style={s.brand}>Arham Always Care</Text>
            <Text style={s.bandSub}>PATIENT REPORT · {model.rangeLabel ?? 'WHOLE STAY'}</Text>
          </View>
          <Text style={s.bandMeta}>
            Generated{' '}
            {new Date(model.generatedAt).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              timeZone: 'Asia/Kolkata',
            })}
          </Text>
        </View>

        <View style={s.hero}>
          {p.avatarAssetId ? (
            <ImgOrPlaceholder id={p.avatarAssetId} images={images} w={96} h={96} style={s.avatar} />
          ) : (
            <View style={s.avatarPh}>
              <Text style={{ fontSize: 9, color: C.soft }}>No photo</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <T style={s.heroName} dyn={p.name}>
              {p.name}
            </T>
            <Text
              style={[
                s.pill,
                {
                  backgroundColor: `${OUTCOME_BG[model.outcome.kind]}22`,
                  color: OUTCOME_BG[model.outcome.kind],
                },
              ]}
            >
              {model.outcome.label}
            </Text>
            <View style={s.kv}>
              {kv('Species', p.breedAge)}
              {kv('Sex / Age', p.sexAge)}
              {kv('Cage', p.cage)}
              {kv(
                'Admitted',
                new Date(p.admittedAt).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  timeZone: 'Asia/Kolkata',
                }),
              )}
              {kv('Complaint', p.complaint)}
              {kv('Diagnosis', p.diagnosis)}
              {kv('Rescuer', p.rescuer)}
              {kv('Brought by', p.broughtBy)}
            </View>
          </View>
        </View>

        <View style={s.stats}>
          <View style={s.tile}>
            <Text style={s.tileN}>{model.stats.days}</Text>
            <Text style={s.tileL}>Days admitted</Text>
          </View>
          {model.stats.perType.map((t) => (
            <View key={t.type} style={s.tile}>
              <Text style={s.tileN}>{t.count}</Text>
              <Text style={s.tileL}>{t.label}</Text>
            </View>
          ))}
          <View style={s.tile}>
            <Text style={s.tileN}>{model.stats.photos}</Text>
            <Text style={s.tileL}>Photos</Text>
          </View>
        </View>
        {model.outcome.causeOfDeath && (
          <T style={s.dline} dyn={model.outcome.causeOfDeath}>
            Cause of death: {model.outcome.causeOfDeath}
          </T>
        )}

        {model.meds.length > 0 && (
          <>
            <Text style={s.sec}>Medications given</Text>
            <View style={s.table}>
              <View style={s.trH}>
                <Text style={s.th}>Drug</Text>
                <Text style={s.th}>Dose</Text>
                <Text style={s.th}>Route</Text>
                <Text style={s.th}>Times</Text>
                <Text style={s.th}>Span</Text>
              </View>
              {model.meds.map((m) => (
                <View key={m.name} style={s.tr}>
                  <T style={[s.td, { fontWeight: 700 }]} dyn={m.name}>
                    {m.name}
                  </T>
                  <Text style={s.td}>{m.doses.join(', ') || '—'}</Text>
                  <Text style={s.td}>{m.routes.join(', ') || '—'}</Text>
                  <Text style={s.td}>{m.times}×</Text>
                  <Text style={s.td}>{m.span}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {model.admissionMedia.length > 0 && (
          <>
            <Text style={s.sec}>Admission media ({model.admissionMedia.length})</Text>
            <View style={s.grid}>
              {model.admissionMedia.map((m: RawMedia) => (
                <View key={m.assetId} style={s.gcell}>
                  <ImgOrPlaceholder id={m.assetId} images={images} w={150} h={108} style={s.gimg} />
                  <Text style={s.gcap}>{m.label || 'Admission'}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <Text style={[s.sec, { fontFamily: 'Noto Serif', fontSize: 12, color: C.ink }]}>Activity log</Text>
        {model.days.map((d) => (
          <View key={d.key}>
            <View style={s.dayBand}>
              <Text style={s.dayLabel}>{d.label}</Text>
              <Text style={s.dayCnt}>
                {d.entries.length} {d.entries.length === 1 ? 'entry' : 'entries'}
              </Text>
            </View>
            {d.entries.map((e) => (
              <ActivityBlock key={`${e.type}-${e.time}`} e={e} images={images} />
            ))}
          </View>
        ))}

        {model.documents.length > 0 && (
          <>
            <Text style={s.sec}>Documents ({model.documents.length})</Text>
            {model.documents.map((doc) => (
              <T key={doc.id} style={s.dline} dyn={doc.name}>
                {doc.category} · {doc.name}
                {doc.file ? '' : ' (no file)'}
              </T>
            ))}
          </>
        )}

        <View style={s.footer} fixed>
          <T style={s.footText} dyn={p.name}>
            {p.name} ({p.species}) · Confidential clinical record
          </T>
          <Text
            style={s.footText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
