import { Chip } from '@/components/ui/Chip';
import { Pill } from '@/components/ui/Pill';
import { relativeTime } from '@/lib/time';
import Image from 'next/image';
import { StatusBadge } from './StatusBadge';

interface Props {
  animal: {
    id: string;
    name: string;
    species: string;
    breed: string | null;
    gender: string | null;
    ageText: string | null;
    weightKg: unknown;
    color: string | null;
    ward: string | null;
    contagious: boolean;
    aggressive: boolean;
    vaccination: string;
    status: 'CRITICAL' | 'STABLE' | 'OBSERVATION' | 'DISCHARGED' | 'DECEASED';
    admittedAt: Date;
    complaint: string | null;
    rescuer: string | null;
    rescuerPhone: string | null;
    media: { asset: { id: string; filename: string } }[];
  };
  lastActivityAt: Date | null;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: presentational layout with several conditional fields
export function AnimalHero({ animal, lastActivityAt }: Props) {
  return (
    <section className="rounded-lg border border-line bg-paper p-5">
      <div className="flex items-start gap-4">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-paper-2 md:h-[62px] md:w-[62px]">
          {animal.media[0] ? (
            <Image
              src={`/api/files/${animal.media[0].asset.id}`}
              alt={animal.name}
              fill
              sizes="64px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-display text-lg text-muted">
              {animal.name[0]?.toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-xl font-bold tracking-tight md:text-[22px]">{animal.name}</h1>
            <StatusBadge status={animal.status} />
          </div>
          <p className="mt-1 text-sm text-muted">
            {animal.species}
            {animal.breed ? ` · ${animal.breed}` : ''}
            {animal.gender ? ` · ${animal.gender.toLowerCase()}` : ''}
            {animal.ageText ? ` · ${animal.ageText}` : ''}
          </p>
          {(animal.weightKg || animal.color) && (
            <p className="text-sm text-muted">
              {animal.weightKg ? `${String(animal.weightKg)} kg` : ''}
              {animal.weightKg && animal.color ? ' · ' : ''}
              {animal.color ?? ''}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {animal.ward && <Chip>{animal.ward}</Chip>}
            {animal.contagious && <Pill status="critical">Contagious</Pill>}
            {animal.aggressive && <Pill status="observation">Aggressive</Pill>}
            <Chip>Vacc: {labelVaccination(animal.vaccination)}</Chip>
          </div>
        </div>
      </div>

      {animal.complaint && (
        <div className="mt-4 rounded-lg bg-surface-2 p-3">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted">
            Chief complaint
          </div>
          <p className="mt-1 text-sm text-text">{animal.complaint}</p>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Stat label="Admitted" value={formatDateTime(animal.admittedAt)} />
        <Stat label="Last update" value={relativeTime(lastActivityAt)} />
        {animal.rescuer && <Stat label="Rescuer" value={animal.rescuer} />}
        {animal.rescuerPhone && <Stat label="Contact" value={animal.rescuerPhone} />}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.05em] text-muted">{label}</div>
      <div className="mt-0.5 text-sm text-text">{value}</div>
    </div>
  );
}

function labelVaccination(v: string): string {
  return v.charAt(0) + v.slice(1).toLowerCase();
}

function formatDateTime(d: Date): string {
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
