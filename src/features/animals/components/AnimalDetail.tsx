import { MediaGrid } from '@/components/media/MediaGrid';
import { ActivityTimeline } from '@/features/activities/components/ActivityTimeline';
import { listActivitiesForAnimal } from '@/features/activities/queries';
import type { ActivityType } from '@/features/activities/schema';
import { DocumentList } from '@/features/documents/components/DocumentList';
import { DocumentUploadDialog } from '@/features/documents/components/DocumentUploadDialog';
import { listDocumentsForAnimal } from '@/features/documents/queries';
import { FileText, Info } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getAnimal } from '../queries';
import { AnimalDetailActions } from './AnimalDetailActions';
import { AnimalDetailTabs } from './AnimalDetailTabs';
import { AnimalHero } from './AnimalHero';
import { VisualRecords } from './VisualRecords';

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
  const [animal, activities, documents] = await Promise.all([
    getAnimal(animalId),
    listActivitiesForAnimal(animalId),
    listDocumentsForAnimal(animalId),
  ]);
  if (!animal) notFound();
  const lastActivityAt = activities[0]?.occurredAt ?? null;

  // Aggregate every photo / x-ray / video the patient has — admission media,
  // every activity's attached media, plus documents that are images.
  // Surfaces in the Documents tab as the "Visual records" grid.
  const visualItems = [
    ...animal.media.map((m) => ({
      id: m.asset.id,
      kind: m.asset.kind as 'PHOTO' | 'VIDEO' | 'XRAY' | 'DOC',
      filename: m.asset.filename,
      label: m.label,
    })),
    ...activities.flatMap((a) =>
      a.media.map((m) => ({
        id: m.asset.id,
        kind: m.asset.kind as 'PHOTO' | 'VIDEO' | 'XRAY' | 'DOC',
        filename: m.asset.filename,
        label: m.label ?? `${a.type.toLowerCase()} · ${m.asset.filename}`,
      })),
    ),
    ...documents
      .filter((d) => d.file !== null)
      .map((d) => ({
        // biome-ignore lint/style/noNonNullAssertion: filtered above
        id: d.file!.id,
        // biome-ignore lint/style/noNonNullAssertion: filtered above
        kind: d.file!.kind as 'PHOTO' | 'VIDEO' | 'XRAY' | 'DOC',
        // biome-ignore lint/style/noNonNullAssertion: filtered above
        filename: d.file!.filename,
        label: d.kind,
      })),
  ];

  const serializedActivities = activities.map((a) => ({
    id: a.id,
    animalId: a.animalId,
    type: a.type as ActivityType,
    occurredAt: a.occurredAt.toISOString(),
    byName: a.byName,
    remarks: a.remarks,
    editedAt: a.editedAt ? a.editedAt.toISOString() : null,
    data: a.data,
    media: a.media.map((m) => ({ id: m.id, assetId: m.assetId, label: m.label })),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <AnimalDetailActions animalId={animal.id} />
      </div>

      <AnimalHero
        animal={{
          id: animal.id,
          name: animal.name,
          species: animal.species,
          breed: animal.breed,
          gender: animal.gender,
          ageText: animal.ageText,
          weightKg: animal.weightKg,
          color: animal.color,
          ward: animal.ward,
          contagious: animal.contagious,
          aggressive: animal.aggressive,
          vaccination: animal.vaccination,
          status: animal.status,
          admittedAt: animal.admittedAt,
          complaint: animal.complaint,
          rescuer: animal.rescuer,
          rescuerPhone: animal.rescuerPhone,
          media: animal.media.map((m) => ({
            asset: { id: m.asset.id, filename: m.asset.filename },
          })),
        }}
        lastActivityAt={lastActivityAt}
      />

      <AnimalDetailTabs
        activeCount={serializedActivities.length}
        docCount={documents.length}
        feed={<ActivityTimeline activities={serializedActivities} />}
        info={
          <div className="flex flex-col gap-4">
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
                <MediaGrid
                  items={animal.media.map((m) => ({
                    id: m.asset.id,
                    kind: m.asset.kind as 'PHOTO' | 'VIDEO' | 'XRAY' | 'DOC',
                    filename: m.asset.filename,
                    label: m.label,
                  }))}
                  columns={4}
                />
              </DetailSection>
            )}
          </div>
        }
        docs={
          <div className="flex flex-col gap-4">
            <VisualRecords items={visualItems} />
            <section className="rounded-lg border border-line bg-paper p-5">
              <header className="mb-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-muted" />
                  <h2 className="font-display font-bold text-base">Documents ({documents.length})</h2>
                </div>
                <DocumentUploadDialog animalId={animal.id} />
              </header>
              <DocumentList documents={documents} />
            </section>
          </div>
        }
      />
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
