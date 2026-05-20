import { AnimalPickerList } from '@/features/reports/components/AnimalPickerList';
import { PerAnimalReportView } from '@/features/reports/components/PerAnimalReportView';
import { ReportsNav } from '@/features/reports/components/ReportsNav';
import { getPerAnimalReport } from '@/features/reports/queries';

export default async function ByAnimalReportPage({
  searchParams,
}: {
  searchParams: Promise<{ animalId?: string }>;
}) {
  const params = await searchParams;
  const animalId = params.animalId ?? null;
  const report = animalId ? await getPerAnimalReport(animalId) : null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display font-bold text-2xl tracking-tight">Reports</h1>
        <p className="mt-1 text-muted text-sm">Activity logs and per-animal case histories</p>
      </div>
      <ReportsNav active="by-animal" />
      <AnimalPickerList selectedId={animalId} />
      {animalId && !report && (
        <p className="text-critical text-sm">Animal not found, deleted, or you don't have access.</p>
      )}
      {report && <PerAnimalReportView report={report} />}
    </div>
  );
}
