import { CagesPanel } from '@/features/cages/components/CagesPanel';
import { listCagesWithOccupancy } from '@/features/cages/queries';
import { requireCageManageRole } from '@/lib/auth';

export default async function CagesPage() {
  await requireCageManageRole();
  const cages = await listCagesWithOccupancy();
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Cages</h1>
        <p className="mt-1 text-sm text-muted">
          Add cages and see who's in each. A cage frees automatically on discharge or death.
        </p>
      </div>
      <CagesPanel initial={cages} />
    </div>
  );
}
