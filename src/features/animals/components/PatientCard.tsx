import Image from 'next/image';
import Link from 'next/link';
import type { AnimalListItem } from '../queries';
import { FreshnessIndicator } from './FreshnessIndicator';
import { StatusBadge } from './StatusBadge';

interface Props {
  animal: AnimalListItem;
}

export function PatientCard({ animal }: Props) {
  return (
    <Link
      href={`/patients/${animal.id}`}
      className="flex items-center gap-3 rounded-lg border border-line bg-paper p-3 transition hover:bg-paper-2"
    >
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-paper-2">
        {animal.thumbnailKey ? (
          <Image
            src={`/api/files/${animal.thumbnailKey.split(':').pop()}`}
            alt={animal.name}
            fill
            sizes="56px"
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
        <div className="flex items-center gap-2">
          <span className="truncate font-display font-semibold">{animal.name}</span>
          {animal.contagious && (
            <span className="rounded bg-critical-bg px-1.5 py-0.5 text-[10px] font-bold text-critical">
              CONTAGIOUS
            </span>
          )}
          {animal.aggressive && (
            <span className="rounded bg-observation-bg px-1.5 py-0.5 text-[10px] font-bold text-observation">
              AGGRESSIVE
            </span>
          )}
        </div>
        <div className="mt-1 truncate text-xs text-muted">
          {animal.species}
          {animal.breed ? ` · ${animal.breed}` : ''}
          {animal.ward ? ` · ${animal.ward}` : ''}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <StatusBadge status={animal.status} />
        <FreshnessIndicator lastActivityAt={animal.lastActivityAt} />
      </div>
    </Link>
  );
}
