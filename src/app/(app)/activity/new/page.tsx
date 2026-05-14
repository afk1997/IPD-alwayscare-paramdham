import { listAnimals } from '@/features/animals/queries';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function NewActivityPage() {
  const animals = await listAnimals({ take: 50 });
  if (animals.length === 0) {
    redirect('/patients/new');
  }
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold tracking-tight">Log activity</h1>
      <p className="text-sm text-muted">Pick a patient to log an activity for.</p>
      <ul className="flex flex-col gap-2">
        {animals.map((a) => (
          <li key={a.id}>
            <Link
              href={`/patients/${a.id}`}
              className="flex items-center justify-between rounded-lg border border-line bg-paper p-3 hover:bg-paper-2"
            >
              <span className="font-display font-semibold">{a.name}</span>
              <span className="text-sm text-muted">
                {a.species}
                {a.ward ? ` · ${a.ward}` : ''}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
