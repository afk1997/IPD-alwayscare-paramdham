import { relativeTime } from '@/lib/time';
import { ChevronRight, Clock } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { AnimalListItem } from '../queries';
import { StatusBadge } from './StatusBadge';

interface Props {
  animal: AnimalListItem;
}

function speciesGradient(species: string): string {
  const map: Record<string, string> = {
    Dog: 'from-[#c69c6d] to-[#7a4a2f]',
    Cat: 'from-[#d2b89d] to-[#8a6a4a]',
    Cow: 'from-[#c08a5a] to-[#7a4a2a]',
    Bird: 'from-[#a8b2bc] to-[#5d6a78]',
    Goat: 'from-[#bca48a] to-[#7a644a]',
    Rabbit: 'from-[#e0d4c0] to-[#a08a6c]',
  };
  return map[species] ?? 'from-[#aab4be] to-[#5a6470]';
}

export function PatientCard({ animal }: Props) {
  const stale =
    !animal.lastActivityAt || Date.now() - new Date(animal.lastActivityAt).getTime() > 6 * 60 * 60 * 1000;

  return (
    <Link
      href={`/patients/${animal.id}`}
      className="flex items-center gap-3 rounded-lg border border-line bg-paper p-3 transition hover:border-accent/40 hover:bg-paper-2"
    >
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl">
        {animal.thumbnailKey ? (
          <Image
            src={`/api/files/${animal.thumbnailKey.split(':').pop()}`}
            alt={animal.name}
            fill
            sizes="48px"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div
            className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${speciesGradient(animal.species)} font-display font-bold text-base text-white`}
          >
            {animal.name[0]?.toUpperCase()}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-display text-base font-semibold">{animal.name}</span>
          <StatusBadge status={animal.status} />
        </div>
        <div className="mt-0.5 truncate text-[12.5px] text-muted">
          {animal.species}
          {animal.breed ? ` · ${animal.breed}` : ''}
          {animal.ward ? ` · ${animal.ward}` : ''}
        </div>
        <div
          className={`mt-1.5 flex items-center gap-1.5 text-[11.5px] ${stale ? 'text-observation' : 'text-soft'}`}
        >
          <Clock size={12} strokeWidth={2} />
          Last update {relativeTime(animal.lastActivityAt)}
          {animal.contagious && <span className="ml-1 font-semibold text-critical">· Contagious</span>}
          {animal.aggressive && <span className="ml-1 font-semibold text-observation">· Aggressive</span>}
        </div>
      </div>
      <ChevronRight size={16} className="shrink-0 text-soft" />
    </Link>
  );
}
