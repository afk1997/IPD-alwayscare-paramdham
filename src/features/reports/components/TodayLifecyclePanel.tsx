import { PatientCard } from '@/features/animals/components/PatientCard';
import { listAnimalCardsByIds } from '@/features/animals/queries';
import { listTodayAdmissions, listTodayDeaths, listTodayDischarges } from '@/features/outcomes/queries';

const LOADERS = {
  admissions: listTodayAdmissions,
  deaths: listTodayDeaths,
  discharges: listTodayDischarges,
} as const;

const EMPTY: Record<keyof typeof LOADERS, string> = {
  admissions: 'No admissions today.',
  deaths: 'No deaths today.',
  discharges: 'No discharges today.',
};

export async function TodayLifecyclePanel({ kind }: { kind: keyof typeof LOADERS }) {
  const rows = await LOADERS[kind]();
  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-line border-dashed bg-paper p-6 text-center text-muted text-sm">
        {EMPTY[kind]}
      </p>
    );
  }
  const cards = await listAnimalCardsByIds(rows.map((r) => r.id));
  const byId = new Map(cards.map((c) => [c.id, c]));
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => {
        const card = byId.get(r.id);
        if (!card) return null;
        return (
          <div key={r.id}>
            <PatientCard animal={card} />
            {r.detail && <p className="mt-1 px-3 text-[12.5px] text-muted">{r.detail}</p>}
          </div>
        );
      })}
    </div>
  );
}
