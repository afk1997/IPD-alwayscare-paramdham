import { ActivityTimeline } from '@/features/activities/components/ActivityTimeline';
import { listActivitiesForAnimal } from '@/features/activities/queries';
import { Activity, FileText, Info } from 'lucide-react';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getAnimal } from '../queries';
import { AnimalDetailActions } from './AnimalDetailActions';
import { FreshnessIndicator } from './FreshnessIndicator';
import { StatusBadge } from './StatusBadge';

const TEST_LABELS: Record<string, string> = {
  XRAY: 'X-ray',
  USG: 'USG',
  BLOOD_TEST: 'Blood test',
  MRI: 'MRI',
  CT_SCAN: 'CT scan',
  SONOGRAPHY: 'Sonography',
};

interface Props {
  animalId: string;
}

export async function AnimalDetail({ animalId }: Props) {
  const [animal, activities] = await Promise.all([getAnimal(animalId), listActivitiesForAnimal(animalId)]);
  if (!animal) notFound();
  const lastActivityAt = activities[0]?.occurredAt ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-line bg-paper p-5">
        <div className="flex items-start gap-4">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-paper-2">
            {animal.media[0] ? (
              <Image
                src={`/api/files/${animal.media[0].asset.id}`}
                alt={animal.name}
                fill
                sizes="80px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-muted">
                {animal.species[0]}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-xl font-bold tracking-tight">{animal.name}</h1>
              <StatusBadge status={animal.status} />
            </div>
            <div className="mt-1 text-sm text-muted">
              {animal.species}
              {animal.breed ? ` · ${animal.breed}` : ''}
              {animal.gender ? ` · ${animal.gender}` : ''}
              {animal.ageText ? ` · ${animal.ageText}` : ''}
              {animal.weightKg ? ` · ${String(animal.weightKg)}kg` : ''}
            </div>
            <div className="mt-2">
              <FreshnessIndicator lastActivityAt={lastActivityAt} />
            </div>
          </div>
          <AnimalDetailActions animalId={animal.id} />
        </div>
      </div>

      <DetailSection icon={Info} title="Details">
        <DetailGrid>
          <Field label="Ward" value={animal.ward} />
          <Field label="Admitted at" value={animal.admittedAt.toLocaleString()} />
          <Field label="Color" value={animal.color} />
          <Field label="Vaccination" value={animal.vaccination} />
          <Field label="Sterilized" value={animal.sterilized ? 'Yes' : 'No'} />
          <Field label="Aggressive" value={animal.aggressive ? 'Yes' : 'No'} />
          <Field label="Contagious" value={animal.contagious ? 'Yes' : 'No'} />
          <Field label="Surgery req'd" value={animal.surgeryRequired} />
        </DetailGrid>
      </DetailSection>

      <DetailSection icon={Info} title="Rescue / Owner">
        <DetailGrid>
          <Field label="Rescuer" value={animal.rescuer} />
          <Field label="Contact" value={animal.rescuerPhone} />
          <Field label="NGO" value={animal.ngo} />
          <Field label="Brought by" value={animal.broughtBy} />
        </DetailGrid>
        {animal.address && (
          <p className="mt-3 text-sm text-text">
            <span className="text-muted">Address: </span>
            {animal.address}
          </p>
        )}
      </DetailSection>

      <DetailSection icon={Info} title="Medical">
        <Field label="Chief complaint" value={animal.complaint} block />
        <Field label="History" value={animal.history} block />
        <Field label="Injury type" value={animal.injuryType} />
        <Field label="Tentative diagnosis" value={animal.diagnosis} block />
        {animal.testsAdvised.length > 0 && (
          <div className="mt-2">
            <div className="text-xs text-muted">Tests advised</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {animal.testsAdvised.map((t) => (
                <span
                  key={t.id}
                  className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-ink"
                >
                  {TEST_LABELS[t.test] ?? t.test}
                </span>
              ))}
            </div>
          </div>
        )}
      </DetailSection>

      {animal.media.length > 0 && (
        <DetailSection icon={FileText} title={`Admission media (${animal.media.length})`}>
          <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
            {animal.media.map((m) => (
              <div
                key={m.id}
                className="relative aspect-square overflow-hidden rounded-md border border-line"
              >
                <Image
                  src={`/api/files/${m.asset.id}`}
                  alt={m.label ?? m.asset.filename}
                  fill
                  sizes="180px"
                  className="object-cover"
                  unoptimized
                />
              </div>
            ))}
          </div>
        </DetailSection>
      )}

      <DetailSection icon={Activity} title={`Activity (${activities.length})`}>
        <ActivityTimeline activities={activities} />
      </DetailSection>
    </div>
  );
}

function DetailSection({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Info;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-line bg-paper p-5">
      <header className="mb-4 flex items-center gap-2">
        <Icon size={16} className="text-muted" />
        <h2 className="font-display text-base font-bold">{title}</h2>
      </header>
      <div>{children}</div>
    </section>
  );
}

function DetailGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{children}</div>;
}

function Field({
  label,
  value,
  block = false,
}: {
  label: string;
  value: string | number | null | undefined;
  block?: boolean;
}) {
  if (!value) return null;
  return (
    <div className={block ? 'col-span-full' : ''}>
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-0.5 text-sm text-text">{value}</div>
    </div>
  );
}
