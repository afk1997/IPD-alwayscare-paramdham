import { MediaGrid } from '@/components/media/MediaGrid';
import { ActivityTimeline } from '@/features/activities/components/ActivityTimeline';
import { listActivitiesForAnimal } from '@/features/activities/queries';
import type { ActivityType } from '@/features/activities/schema';
import { listAssignableCages } from '@/features/cages/queries';
import { DocumentList } from '@/features/documents/components/DocumentList';
import { DocumentUploadDialog } from '@/features/documents/components/DocumentUploadDialog';
import { listDocumentsForAnimal } from '@/features/documents/queries';
import { FileText, type Info } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getAnimal } from '../queries';
import { AnimalDetailActions } from './AnimalDetailActions';
import { AnimalDetailTabs } from './AnimalDetailTabs';
import { AnimalDetailsTab } from './AnimalDetailsTab';
import { AnimalHero } from './AnimalHero';
import { VisualRecords } from './VisualRecords';

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
  const cages = await listAssignableCages(animalId);
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
      url: m.url,
    })),
    ...activities.flatMap((a) =>
      a.media.map((m) => ({
        id: m.asset.id,
        kind: m.asset.kind as 'PHOTO' | 'VIDEO' | 'XRAY' | 'DOC',
        filename: m.asset.filename,
        label: m.label ?? `${a.type.toLowerCase()} · ${m.asset.filename}`,
        url: m.url,
      })),
    ),
    ...documents
      .filter((d) => d.file !== null && d.fileUrl !== null)
      .map((d) => ({
        // biome-ignore lint/style/noNonNullAssertion: filtered above
        id: d.file!.id,
        // biome-ignore lint/style/noNonNullAssertion: filtered above
        kind: d.file!.kind as 'PHOTO' | 'VIDEO' | 'XRAY' | 'DOC',
        // biome-ignore lint/style/noNonNullAssertion: filtered above
        filename: d.file!.filename,
        label: d.kind,
        // biome-ignore lint/style/noNonNullAssertion: filtered above
        url: d.fileUrl!,
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
    media: a.media.map((m) => ({
      id: m.id,
      assetId: m.assetId,
      kind: m.asset.kind,
      label: m.label,
      url: m.url,
    })),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <AnimalDetailActions animalId={animal.id} status={animal.status} />
      </div>

      <AnimalHero
        animal={{
          id: animal.id,
          name: animal.name,
          species: animal.species,
          breed: animal.breed,
          gender: animal.gender,
          ageText: animal.ageText,
          // Prisma Decimal isn't serializable across the RSC boundary
          // (AnimalHero is a client component for the lightbox state) —
          // stringify here, same as AnimalDetailsTab does just below.
          weightKg: animal.weightKg ? String(animal.weightKg) : null,
          color: animal.color,
          ward: animal.ward,
          cage: animal.cage,
          contagious: animal.contagious,
          aggressive: animal.aggressive,
          vaccination: animal.vaccination,
          status: animal.status,
          admittedAt: animal.admittedAt,
          complaint: animal.complaint,
          rescuer: animal.rescuer,
          rescuerPhone: animal.rescuerPhone,
          media: animal.media.map((m) => ({
            url: m.url,
            asset: { id: m.asset.id, filename: m.asset.filename, kind: m.asset.kind },
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
            <AnimalDetailsTab
              cages={cages}
              animal={{
                id: animal.id,
                name: animal.name,
                species: animal.species,
                breed: animal.breed,
                gender: animal.gender,
                ageText: animal.ageText,
                color: animal.color,
                weightKg: animal.weightKg ? String(animal.weightKg) : null,
                vaccination: animal.vaccination,
                sterilized: animal.sterilized,
                aggressive: animal.aggressive,
                contagious: animal.contagious,
                ward: animal.ward,
                cage: animal.cage?.name ?? null,
                cageId: animal.cageId,
                status: animal.status,
                admittedAt: animal.admittedAt.toISOString(),
                complaint: animal.complaint,
                history: animal.history,
                injuryType: animal.injuryType,
                diagnosis: animal.diagnosis,
                immediateTreatment: animal.immediateTreatment,
                surgeryRequired: animal.surgeryRequired,
                rescuer: animal.rescuer,
                rescuerPhone: animal.rescuerPhone,
                address: animal.address,
                ngo: animal.ngo,
                broughtBy: animal.broughtBy,
                testsAdvised: animal.testsAdvised.map((t) => t.test),
              }}
            />

            {animal.media.length > 0 && (
              <DetailSection icon={FileText} title={`Admission media (${animal.media.length})`}>
                <MediaGrid
                  items={animal.media.map((m) => ({
                    id: m.asset.id,
                    kind: m.asset.kind as 'PHOTO' | 'VIDEO' | 'XRAY' | 'DOC',
                    filename: m.asset.filename,
                    label: m.label,
                    url: m.url,
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
