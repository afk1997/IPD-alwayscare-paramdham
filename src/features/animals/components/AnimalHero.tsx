'use client';
import { Lightbox } from '@/components/media/Lightbox';
import { Photo } from '@/components/media/Photo';
import { Chip } from '@/components/ui/Chip';
import { Pill } from '@/components/ui/Pill';
import { relativeTime } from '@/lib/time';
import { useState } from 'react';
import { StatusBadge } from './StatusBadge';

interface Props {
  animal: {
    id: string;
    name: string;
    species: string;
    breed: string | null;
    gender: string | null;
    ageText: string | null;
    weightKg: string | null;
    color: string | null;
    ward: string | null;
    cage: { name: string } | null;
    contagious: boolean;
    aggressive: boolean;
    vaccination: string;
    status: 'CRITICAL' | 'STABLE' | 'OBSERVATION' | 'DISCHARGED' | 'DECEASED';
    admittedAt: Date;
    complaint: string | null;
    rescuer: string | null;
    rescuerPhone: string | null;
    media: { asset: { id: string; filename: string; kind: 'PHOTO' | 'VIDEO' | 'XRAY' | 'DOC' } }[];
  };
  lastActivityAt: Date | null;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: presentational hero with many conditional rows
export function AnimalHero({ animal, lastActivityAt }: Props) {
  const photoSrc = animal.media[0]?.asset.id ? `/api/files/${animal.media[0].asset.id}` : undefined;
  const stale = !lastActivityAt || Date.now() - new Date(lastActivityAt).getTime() > 6 * 60 * 60 * 1000;
  // Tap-to-expand the hero photo into the same Lightbox that the
  // "Admission media" grid below already uses — items are the full
  // admission media set so the user can swipe through all of them.
  const lightboxItems = animal.media.map((m) => ({
    id: m.asset.id,
    filename: m.asset.filename,
    kind: m.asset.kind,
  }));
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  return (
    <section className="rounded-2xl border border-line bg-paper p-5 md:p-6">
      <div className="flex items-start gap-4">
        {photoSrc ? (
          <button
            type="button"
            onClick={() => setLightboxIndex(0)}
            aria-label={`Open ${animal.name}'s photo`}
            className="shrink-0 cursor-zoom-in rounded-2xl outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent"
          >
            <Photo
              seed={animal.id}
              src={photoSrc}
              alt={animal.name}
              rounded={16}
              className="h-[68px] w-[68px] md:h-[78px] md:w-[78px]"
            />
          </button>
        ) : (
          <Photo
            seed={animal.id}
            src={undefined}
            alt={animal.name}
            rounded={16}
            className="h-[68px] w-[68px] shrink-0 md:h-[78px] md:w-[78px]"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-extrabold tracking-tight md:text-[26px]">
              {animal.name}
            </h1>
            <StatusBadge status={animal.status} />
          </div>
          <p className="mt-1 text-[13.5px] text-muted">
            {animal.species}
            {animal.breed ? ` · ${animal.breed}` : ''}
            {animal.gender ? ` · ${capitalize(animal.gender)}` : ''}
            {animal.ageText ? ` · ${animal.ageText}` : ''}
          </p>
          {(animal.weightKg || animal.color) && (
            <p className="text-[13.5px] text-muted">
              {animal.weightKg ? `${String(animal.weightKg)} kg` : ''}
              {animal.weightKg && animal.color ? ' · ' : ''}
              {animal.color ?? ''}
            </p>
          )}
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {animal.ward && <Chip>{animal.ward}</Chip>}
            {animal.cage && <Chip>🏠 {animal.cage.name}</Chip>}
            {animal.contagious && <Pill status="critical">Contagious</Pill>}
            {animal.aggressive && <Pill status="observation">Aggressive</Pill>}
            <Chip>Vacc: {capitalize(animal.vaccination)}</Chip>
          </div>
        </div>
      </div>

      {animal.complaint && (
        <div className="mt-4 rounded-xl bg-surface-2 px-3.5 py-3">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-muted">
            Chief complaint
          </div>
          <p className="mt-1 text-sm text-text">{animal.complaint}</p>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
        <Stat label="Admitted" value={formatDateTime(animal.admittedAt)} />
        <Stat label="Last update" value={relativeTime(lastActivityAt)} tone={stale ? 'warn' : undefined} />
        {animal.rescuer && <Stat label="Rescuer" value={animal.rescuer} />}
        {animal.rescuerPhone && <Stat label="Contact" value={animal.rescuerPhone} />}
      </div>
      <Lightbox
        items={lightboxItems}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onChange={setLightboxIndex}
      />
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'warn' | undefined }) {
  return (
    <div>
      <div className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-muted">{label}</div>
      <div
        className={`mt-1 text-[13.5px] ${tone === 'warn' ? 'font-semibold text-observation' : 'text-text'}`}
      >
        {value}
      </div>
    </div>
  );
}

function capitalize(s: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function formatDateTime(d: Date): string {
  // Fixed `en-GB` + 24-hour avoids SSR/CSR locale-driven hydration warnings.
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
