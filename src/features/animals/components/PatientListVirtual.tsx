'use client';
import type { AnimalListItem } from '../queries';
import { PatientCard } from './PatientCard';

interface Props {
  animals: AnimalListItem[];
}

// Renders the full admitted-patient list without virtualization. The app
// shell scrolls an inner `overflow-auto` container (AppShell), not the
// window, so the previous `useWindowVirtualizer` only ever mounted the first
// viewport of rows (the inner scroll never reached the window listener) —
// patients past the fold silently never rendered. At clinic scale (tens of
// admitted patients, capped at 200 by the query) a plain list is correct and
// cheaper than wiring a scroll-element virtualizer.
export function PatientListVirtual({ animals }: Props) {
  return (
    <div className="flex flex-col gap-2">
      {animals.map((animal) => (
        <PatientCard key={animal.id} animal={animal} />
      ))}
    </div>
  );
}
