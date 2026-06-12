import { Image, Text, View } from '@react-pdf/renderer';
import type React from 'react';
import { LOGO_AR } from './assets';
import { FitImage, KV, T } from './components';
import type { ReportImage } from './fit';
import type { RawMedia, ReportEntry, ReportModel, SectionEntry } from './model';
import { BRAND, OUTCOME_BG, TYPE_COLOR, s } from './styles';

const CLINIC_NAME = 'Arham Always Care';

// react-pdf 4.5.1 types don't expose `bookmark` on ViewProps, but the prop
// is supported at runtime.  This thin wrapper avoids scattering `as any`.
function BV({
  title,
  wrap,
  children,
}: {
  title: string;
  wrap?: boolean;
  children: React.ReactNode;
}) {
  const props = { bookmark: { title }, ...(wrap === false ? { wrap: false } : {}) };
  return <View {...(props as Record<string, unknown>)}>{children}</View>;
}

const istDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
const istDateTime = (iso: string) =>
  `${istDate(iso)}, ${new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  })} IST`;

// ── Chrome ────────────────────────────────────────────────────────────────

export function Masthead({ model, logo }: { model: ReportModel; logo: Buffer | null }) {
  return (
    <View style={s.masthead}>
      {logo ? (
        <Image src={logo} style={{ width: 200, height: 200 * LOGO_AR }} />
      ) : (
        <Text style={s.mastBrandFallback}>{CLINIC_NAME}</Text>
      )}
      <Text style={s.mastKicker}>
        PATIENT REPORT · {(model.rangeLabel ?? 'WHOLE STAY').toUpperCase()} · GENERATED{' '}
        {istDate(model.generatedAt).toUpperCase()}
      </Text>
    </View>
  );
}

// Fixed compact header — renders on pages 2+ only. The OUTER fixed View
// carries the absolute position (pinned to the physical page top, like the
// Footer) but no paint, so page 1 shows nothing; the styled bar lives inside
// the render prop. Keeping the bar's visuals off the outer node matters: an
// empty styled bar would otherwise paint over the page-1 masthead.
export function PageHeader({ model, logo }: { model: ReportModel; logo: Buffer | null }) {
  return (
    <View
      fixed
      style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
      render={({ pageNumber }) =>
        pageNumber === 1 ? null : (
          <View style={s.pgHead}>
            {logo ? (
              <Image src={logo} style={{ width: 56, height: 56 * LOGO_AR }} />
            ) : (
              <Text style={{ fontFamily: 'Noto Serif', fontWeight: 700, fontSize: 9, color: BRAND.red }}>
                {CLINIC_NAME}
              </Text>
            )}
            <T style={s.pgHeadMeta} dyn={model.patient.name}>
              {model.patient.name.toUpperCase()} · PATIENT REPORT · {istDate(model.generatedAt).toUpperCase()}
            </T>
          </View>
        )
      }
    />
  );
}

export function Footer({ model }: { model: ReportModel }) {
  return (
    <View style={s.footer} fixed>
      <T style={s.footText} dyn={model.patient.name}>
        {model.patient.name} ({model.patient.species}) · Confidential clinical record
      </T>
      <Text
        style={s.footText}
        render={({ pageNumber, totalPages }) => `${CLINIC_NAME} · Page ${pageNumber} of ${totalPages}`}
      />
    </View>
  );
}

// ── Page-1 content ────────────────────────────────────────────────────────

export function Hero({ model, images }: { model: ReportModel; images: Map<string, ReportImage> }) {
  const p = model.patient;
  return (
    <View style={s.hero}>
      {p.avatarAssetId ? (
        <FitImage id={p.avatarAssetId} images={images} maxW={110} maxH={110} />
      ) : (
        <View style={[s.imgPh, { width: 96, height: 96 }]}>
          <Text style={{ fontSize: 9, color: BRAND.soft }}>No photo</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <T style={s.heroName} dyn={p.name}>
          {p.name}
        </T>
        <Text
          style={[
            s.pill,
            { backgroundColor: `${OUTCOME_BG[model.outcome.kind]}22`, color: OUTCOME_BG[model.outcome.kind] },
          ]}
        >
          {model.outcome.label}
        </Text>
        <View style={s.kv}>
          <KV label="Species" val={p.breedAge} />
          <KV label="Sex / Age" val={p.sexAge} />
          <KV label="Cage" val={p.cage} />
          <KV label="Admitted" val={istDate(p.admittedAt)} />
          <KV label="Complaint" val={p.complaint} />
          <KV label="Diagnosis" val={p.diagnosis} />
          <KV label="Rescuer" val={p.rescuer} />
          <KV label="Brought by" val={p.broughtBy} />
        </View>
      </View>
    </View>
  );
}

export function RecoveryStrip({ model, images }: { model: ReportModel; images: Map<string, ReportImage> }) {
  if (!model.recovery) return null;
  return (
    <>
      <Text style={s.sec}>Recovery</Text>
      <View style={s.recoveryRow}>
        <View>
          <FitImage id={model.recovery.first.assetId} images={images} maxW={160} maxH={120} />
          <Text style={s.gcap}>{model.recovery.first.label}</Text>
        </View>
        {/* '»' — U+2192 '→' is not in the bundled NotoSans subset and falls
            back to a Helvetica quote glyph. */}
        <Text style={s.recoveryArrow}>»</Text>
        <View>
          <FitImage id={model.recovery.last.assetId} images={images} maxW={160} maxH={120} />
          <Text style={s.gcap}>{model.recovery.last.label}</Text>
        </View>
      </View>
    </>
  );
}

export function StatTiles({ model }: { model: ReportModel }) {
  return (
    <BV title="Stay at a glance">
      <Text style={s.sec}>Stay at a glance</Text>
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
    </BV>
  );
}

export function MedsTable({ model }: { model: ReportModel }) {
  if (model.meds.length === 0) return null;
  return (
    <BV title="Medications">
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
    </BV>
  );
}

// ── Pull-out clinical sections ────────────────────────────────────────────

function SectionCard({ e, images }: { e: SectionEntry; images: Map<string, ReportImage> }) {
  const color = TYPE_COLOR[e.type] ?? BRAND.muted;
  return (
    <View style={[s.sectionCard, { borderLeftColor: color }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        {/* flex:1 bounds the title so a long summary wraps instead of running
            under the right-aligned timestamp. */}
        <T style={{ fontSize: 10, fontWeight: 700, flex: 1, paddingRight: 8 }} dyn={e.summary}>
          {e.summary}
        </T>
        <Text style={s.time}>
          {e.dayLabel} · {e.time}
        </Text>
      </View>
      {e.details.map((l) => (
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
      {e.stills.length > 0 && (
        <View style={s.grid}>
          {e.stills.map((m) => (
            <View key={m.assetId}>
              <FitImage id={m.assetId} images={images} maxW={150} maxH={220} />
              <Text style={s.gcap}>
                {e.time} · {m.label || (m.kind === 'XRAY' ? 'X-ray' : 'Photo')}
              </Text>
            </View>
          ))}
        </View>
      )}
      <T style={s.by} dyn={e.byName}>
        by {e.byName}
        {e.edited ? ' · edited' : ''}
      </T>
    </View>
  );
}

export function SurgerySection({ model, images }: { model: ReportModel; images: Map<string, ReportImage> }) {
  if (model.surgeries.length === 0) return null;
  return (
    <BV title="Surgery">
      <Text style={s.sec}>Surgery</Text>
      {model.surgeries.map((e) => (
        <SectionCard key={e.occurredAt} e={e} images={images} />
      ))}
    </BV>
  );
}

export function DiagnosticsSection({
  model,
  images,
}: { model: ReportModel; images: Map<string, ReportImage> }) {
  if (model.diagnostics.length === 0) return null;
  return (
    <BV title="Diagnostics">
      <Text style={s.sec}>Diagnostics</Text>
      {model.diagnostics.map((e) => (
        <SectionCard key={e.occurredAt} e={e} images={images} />
      ))}
    </BV>
  );
}

export function AdmissionMediaSection({
  model,
  images,
}: { model: ReportModel; images: Map<string, ReportImage> }) {
  if (model.admissionMedia.length === 0) return null;
  return (
    <BV title="Admission media">
      <Text style={s.sec}>Admission media ({model.admissionMedia.length})</Text>
      <View style={s.grid}>
        {model.admissionMedia.map((m: RawMedia) => (
          <View key={m.assetId}>
            <FitImage id={m.assetId} images={images} maxW={150} maxH={220} />
            <Text style={s.gcap}>{m.label || 'Admission'}</Text>
          </View>
        ))}
      </View>
    </BV>
  );
}

// ── Day-by-day log ────────────────────────────────────────────────────────

function detailPill(text: string, i: number) {
  return text.length <= 26 &&
    !/^(Notes|Remarks|Findings|Interpretation|Complications|Post-op|Bath notes|Summary):/.test(text) ? (
    <T key={i} style={s.dpill}>
      {text}
    </T>
  ) : null;
}

function ActivityBlock({ e, images }: { e: ReportEntry; images: Map<string, ReportImage> }) {
  const color = TYPE_COLOR[e.type] ?? BRAND.muted;
  const label = e.type[0] + e.type.slice(1).toLowerCase();

  // SURGERY / DIAGNOSTIC live as full cards in their own sections; the log
  // keeps a compact, cross-referenced row so the chronology stays complete.
  if (e.crossRef) {
    return (
      <View style={[s.crow, { borderLeftColor: color }]} wrap={false}>
        <Text style={s.time}>{e.time}</Text>
        <Text style={[s.chip, { backgroundColor: `${color}22`, color }]}>{label}</Text>
        <T style={{ flex: 1, fontSize: 9 }} dyn={e.summary}>
          {e.summary}
        </T>
        <Text style={s.crossRef}>
          {e.crossRef === 'surgery' ? '» Surgery section' : '» Diagnostics section'}
        </Text>
      </View>
    );
  }

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
          <FitImage id={e.stills[0]?.assetId ?? ''} images={images} maxW={150} maxH={220} />
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
          <View key={m.assetId}>
            <FitImage id={m.assetId} images={images} maxW={150} maxH={220} />
            <Text style={s.gcap}>
              {e.time} · {m.label || (m.kind === 'XRAY' ? 'X-ray' : 'Photo')}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function DayLog({ model, images }: { model: ReportModel; images: Map<string, ReportImage> }) {
  return (
    <BV title="Day-by-day log">
      <Text style={[s.sec, { fontFamily: 'Noto Serif', fontSize: 12, color: BRAND.ink }]}>
        Day-by-day log
      </Text>
      {model.days.map((d) => (
        <View key={d.key}>
          <View style={s.dayBand} minPresenceAhead={40}>
            <Text style={s.dayLabel}>{d.label}</Text>
            <Text style={s.dayCnt}>
              {d.entries.length} {d.entries.length === 1 ? 'entry' : 'entries'}
            </Text>
          </View>
          {d.entries.map((e) => (
            <ActivityBlock key={e.occurredAt} e={e} images={images} />
          ))}
        </View>
      ))}
    </BV>
  );
}

export function DocumentsList({ model }: { model: ReportModel }) {
  if (model.documents.length === 0) return null;
  return (
    <BV title="Documents">
      <Text style={s.sec}>Documents ({model.documents.length})</Text>
      {model.documents.map((doc) => (
        <T key={doc.id} style={s.dline} dyn={doc.name}>
          {doc.category} · {doc.name}
          {doc.file ? '' : ' (no file)'}
        </T>
      ))}
    </BV>
  );
}

// ── Closing ───────────────────────────────────────────────────────────────

export function OutcomeSignoff({ model }: { model: ReportModel }) {
  const tone = OUTCOME_BG[model.outcome.kind];
  return (
    <BV title="Outcome & sign-off">
      <Text style={s.sec}>Outcome & sign-off</Text>
      <View style={[s.outcomeBox, { borderColor: tone, backgroundColor: `${tone}0d` }]}>
        <Text style={[s.outcomeTitle, { color: tone }]}>{model.outcome.label.toUpperCase()}</Text>
        {model.outcome.causeOfDeath && (
          <T style={s.dline} dyn={model.outcome.causeOfDeath}>
            Cause of death: {model.outcome.causeOfDeath}
          </T>
        )}
        {model.outcome.summary && (
          <T style={s.dline} dyn={model.outcome.summary}>
            {model.outcome.summary}
          </T>
        )}
        {model.outcome.instructions && (
          <T style={s.dline} dyn={model.outcome.instructions}>
            Aftercare: {model.outcome.instructions}
          </T>
        )}
        {model.outcome.byName && (
          <T style={s.by} dyn={model.outcome.byName}>
            {model.outcome.kind === 'deceased' ? 'Recorded by ' : 'Discharged by '}
            {model.outcome.byName}
          </T>
        )}
      </View>
      <View wrap={false}>
        <View style={s.signRow}>
          <View style={s.signCell}>
            <View style={s.signRule} />
            <Text style={s.signLabel}>Attending veterinarian</Text>
          </View>
          <View style={s.signCell}>
            <View style={s.signRule} />
            <Text style={s.signLabel}>Date</Text>
          </View>
        </View>
        <T style={s.provenance} dyn={model.generatedByName}>
          Generated from IPD records on {istDateTime(model.generatedAt)} · by {model.generatedByName}
        </T>
      </View>
    </BV>
  );
}
