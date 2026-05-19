import { Photo } from '@/components/media/Photo';
import { relativeTime } from '@/lib/time';
import { ChevronRight, Clock } from 'lucide-react';
import Link from 'next/link';
import type { AnimalListItem } from '../queries';
import { StatusBadge } from './StatusBadge';

interface Props {
  animal: AnimalListItem;
}

export function PatientCard({ animal }: Props) {
  const stale =
    !animal.lastActivityAt || Date.now() - new Date(animal.lastActivityAt).getTime() > 6 * 60 * 60 * 1000;
  const photoSrc = animal.thumbnailKey ? `/api/files/${animal.thumbnailKey.split(':').pop()}` : undefined;

  return (
    <Link
      href={`/patients/${animal.id}`}
      className="flex items-center gap-3 rounded-2xl border border-line bg-paper p-3 transition hover:border-accent/40 hover:bg-paper-2"
    >
      <Photo
        seed={animal.id}
        src={photoSrc}
        alt={animal.name}
        rounded={14}
        className="h-[60px] w-[60px] shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-display text-base font-bold">{animal.name}</span>
          <StatusBadge status={animal.status} />
        </div>
        <div className="mt-1 truncate text-[12.5px] text-muted">
          {animal.species}
          {animal.breed ? ` · ${animal.breed}` : ''}
          {animal.ward ? ` · ${animal.ward}` : ''}
        </div>
        <div
          className={`mt-1.5 flex items-center gap-1.5 text-[11.5px] ${stale ? 'text-observation' : 'text-soft'}`}
        >
          <Clock size={12} strokeWidth={2} />
          <span>Last update {relativeTime(animal.lastActivityAt)}</span>
          {animal.contagious && <span className="ml-1 font-semibold text-critical">· Contagious</span>}
          {animal.aggressive && <span className="ml-1 font-semibold text-observation">· Aggressive</span>}
        </div>
      </div>
      <ChevronRight size={16} className="shrink-0 text-soft" />
    </Link>
  );
}
