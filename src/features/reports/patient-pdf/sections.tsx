import { Image, Text, View } from '@react-pdf/renderer';
import type React from 'react';
import { LOGO_AR } from './assets';
import { FitImage, KV, T } from './components';
import type { ReportImage } from './fit';
import type { RawMedia, ReportEntry, ReportModel } from './model';
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

// Full-width key-value row for intake fields whose values run long
// (complaint, history, treatment notes); hidden when the value is empty.
function KVWide({ label, val }: { label: string; val: string | null }) {
  if (!val) return null;
  return (
    <View style={[s.kvItem, { width: '100%' }]}>
      <Text style={s.k}>{label}</Text>
      <T style={s.v} dyn={val}>
        {val}
      </T>
    </View>
  );
}

// ── Chrome ────────────────────────────────────────────────────────────────

export function Masthead({ model, logo }: { model: ReportModel; logo: Buffer | null }) {
  return (
    <View style={s.masthead}>
      {logo ? (
        <Image src={logo} style={{ width: 150, height: 150 * LOGO_AR }} />
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
              <Image src={logo} style={{ width: 48, height: 48 * LOGO_AR }} />
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

// ── Page-1 content: identity + the full intake form ──────────────────────

export function Hero({ model, images }: { model: ReportModel; images: Map<string, ReportImage> }) {
  const p = model.patient;
  return (
    <View style={s.hero}>
      {p.avatarAssetId ? (
        <FitImage id={p.avatarAssetId} images={images} maxW={104} maxH={104} />
      ) : (
        <View style={[s.imgPh, { width: 96, height: 96 }]}>
          <Text style={{ fontSize: 9, color: BRAND.soft }}>No photo</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <T style={s.heroName} dyn={p.name}>
          {p.name}
        </T>
        <Text style={[s.outcomeInline, { color: OUTCOME_BG[model.outcome.kind] }]}>
          {model.outcome.label.toUpperCase()}
        </Text>
        <View style={s.kv}>
          <KV label="Species" val={p.breedAge} />
          <KV label="Sex / Age" val={p.sexAge} />
          <KV label="Color" val={p.color} />
          <KV label="Weight" val={p.weightKg ? `${p.weightKg} kg` : null} />
          <KV label="Vaccination" val={p.vaccination} />
          <KV label="Flags" val={p.flags} />
          <KV label="Cage" val={p.cage} />
          <KV label="Admitted" val={istDate(p.admittedAt)} />
        </View>
      </View>
    </View>
  );
}

export function MedicalIntake({ model }: { model: ReportModel }) {
  const p = model.patient;
  const fields = [
    p.complaint,
    p.injuryType,
    p.history,
    p.diagnosis,
    p.immediateTreatment,
    p.surgeryRequired,
    p.testsAdvised,
  ];
  if (!fields.some(Boolean)) return null;
  return (
    <BV title="Medical intake">
      <Text style={s.sec}>Medical intake</Text>
      <View style={s.kv}>
        <KVWide label="Complaint" val={p.complaint} />
        <KVWide label="Injury type" val={p.injuryType} />
        <KVWide label="History" val={p.history} />
        <KVWide label="Diagnosis" val={p.diagnosis} />
        <KVWide label="Treatment" val={p.immediateTreatment} />
        <KVWide label="Surgery req." val={p.surgeryRequired} />
        <KVWide label="Tests advised" val={p.testsAdvised} />
      </View>
    </BV>
  );
}

export function RescueIntake({ model }: { model: ReportModel }) {
  const p = model.patient;
  if (!p.rescuer && !p.rescuerPhone && !p.address && !p.ngo && !p.broughtBy) return null;
  return (
    <BV title="Rescue & owner">
      <Text style={s.sec}>Rescue / owner</Text>
      <View style={s.kv}>
        <KV label="Rescuer" val={p.rescuer} />
        <KV label="Contact" val={p.rescuerPhone} />
        <KV label="NGO" val={p.ngo} />
        <KV label="Brought by" val={p.broughtBy} />
        <KVWide label="Address" val={p.address} />
      </View>
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
            <FitImage id={m.assetId} images={images} maxW={150} maxH={210} />
            <Text style={s.gcap}>{m.label || 'Admission'}</Text>
          </View>
        ))}
      </View>
    </BV>
  );
}

// ── Day-by-day log ────────────────────────────────────────────────────────

const LONG_DETAIL = /^(Notes|Remarks|Findings|Interpretation|Complications|Post-op|Bath notes|Summary):/;

function ActivityBlock({ e, images }: { e: ReportEntry; images: Map<string, ReportImage> }) {
  const color = TYPE_COLOR[e.type] ?? BRAND.muted;
  const label = e.type[0] + e.type.slice(1).toLowerCase();
  const short = e.details.filter((d) => d.length <= 26 && !LONG_DETAIL.test(d));
  const long = e.details.filter((d) => d.length > 26 || LONG_DETAIL.test(d));
  const hasBody = long.length > 0 || e.links.length > 0 || e.stills.length > 0;

  return (
    <View style={s.row} {...(e.stills.length === 0 ? { wrap: false } : {})}>
      <Text style={s.time}>{e.time}</Text>
      <View style={[s.dot, { backgroundColor: color }]} />
      <Text style={s.typeTag}>{label}</Text>
      <View style={s.entryBody}>
        <T style={s.summaryMin} dyn={e.summary}>
          {e.summary}
        </T>
        {short.length > 0 && (
          <T style={s.detailLine} dyn={short.join('   ·   ')}>
            {short.join('   ·   ')}
          </T>
        )}
        {long.map((l) => (
          <T key={l} style={s.detailLine} dyn={l}>
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
                <FitImage id={m.assetId} images={images} maxW={148} maxH={200} />
                <Text style={s.gcap}>{m.label || (m.kind === 'XRAY' ? 'X-ray' : 'Photo')}</Text>
              </View>
            ))}
          </View>
        )}
        {hasBody && (
          <T style={s.byMin} dyn={e.byName}>
            by {e.byName}
            {e.edited ? ' · edited' : ''}
          </T>
        )}
      </View>
    </View>
  );
}

export function DayLog({ model, images }: { model: ReportModel; images: Map<string, ReportImage> }) {
  return (
    <BV title="Day-by-day log">
      <Text style={s.sec}>Day-by-day log</Text>
      {model.days.map((d) => (
        <View key={d.key}>
          <View style={s.dayHead} minPresenceAhead={40}>
            <Text style={s.dayLabel}>{d.label}</Text>
            <Text style={s.dayCnt}>
              {d.entries.length} {d.entries.length === 1 ? 'ENTRY' : 'ENTRIES'}
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
        <T key={doc.id} style={s.detailLine} dyn={doc.name}>
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
    <BV title="Outcome">
      <Text style={s.sec}>Outcome</Text>
      <Text style={[s.outcomeStatus, { color: tone }]}>{model.outcome.label.toUpperCase()}</Text>
      {!!model.outcome.causeOfDeath && (
        <T style={s.outcomeLine} dyn={model.outcome.causeOfDeath}>
          Cause of death: {model.outcome.causeOfDeath}
        </T>
      )}
      {!!model.outcome.summary && (
        <T style={s.outcomeLine} dyn={model.outcome.summary}>
          {model.outcome.summary}
        </T>
      )}
      {!!model.outcome.instructions && (
        <T style={s.outcomeLine} dyn={model.outcome.instructions}>
          Aftercare: {model.outcome.instructions}
        </T>
      )}
      {!!model.outcome.byName && (
        <T style={s.byMin} dyn={model.outcome.byName}>
          {model.outcome.kind === 'deceased' ? 'Recorded by ' : 'Discharged by '}
          {model.outcome.byName}
        </T>
      )}
      <T style={s.provenance} dyn={model.generatedByName}>
        Generated from IPD records on {istDateTime(model.generatedAt)} · by {model.generatedByName}
      </T>
    </BV>
  );
}
