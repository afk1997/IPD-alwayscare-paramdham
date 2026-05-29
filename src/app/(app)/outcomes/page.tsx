import { OutcomesTabs } from '@/features/outcomes/components/OutcomesTabs';
import { listDeaths, listDischarges } from '@/features/outcomes/queries';
import { requireOutcomeReadRole } from '@/lib/auth';

export default async function OutcomesPage() {
  await requireOutcomeReadRole();
  const [deaths, discharges] = await Promise.all([listDeaths(), listDischarges()]);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display font-bold text-2xl tracking-tight">Outcomes</h1>
        <p className="mt-1 text-muted text-sm">Deaths and discharges across all patients</p>
      </div>
      <OutcomesTabs
        deaths={deaths.map((d) => ({
          animalId: d.animalId,
          animalName: d.animalName,
          animalSpecies: d.animalSpecies,
          detail: d.causeOfDeath,
          at: d.diedAt.toISOString(),
          byName: d.recordedByName,
        }))}
        discharges={discharges.map((d) => ({
          animalId: d.animalId,
          animalName: d.animalName,
          animalSpecies: d.animalSpecies,
          detail: d.summary,
          at: d.dischargedAt.toISOString(),
          byName: d.dischargedByName,
        }))}
      />
    </div>
  );
}
