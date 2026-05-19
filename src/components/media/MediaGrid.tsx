'use client';
import { FileText, Play } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { Lightbox, type LightboxItem } from './Lightbox';

interface Props {
  items: LightboxItem[];
  /** Optional empty-state copy.  Hidden if not provided. */
  emptyLabel?: string;
  columns?: 3 | 4;
}

export function MediaGrid({ items, emptyLabel, columns = 3 }: Props) {
  const [index, setIndex] = useState<number | null>(null);

  if (items.length === 0) {
    if (!emptyLabel) return null;
    return <p className="text-[12.5px] text-muted">{emptyLabel}</p>;
  }

  const colClass = columns === 4 ? 'md:grid-cols-4' : 'md:grid-cols-3';

  return (
    <>
      <div className={`grid grid-cols-3 gap-2 ${colClass}`}>
        {items.map((it, idx) => (
          <button
            type="button"
            key={it.id}
            onClick={() => setIndex(idx)}
            className="group relative aspect-square overflow-hidden rounded-lg border border-line bg-paper-2 transition hover:border-accent"
          >
            {it.kind === 'PHOTO' || it.kind === 'XRAY' ? (
              <Image
                src={`/api/files/${it.id}`}
                alt={it.label || it.filename}
                fill
                sizes="200px"
                className="object-cover transition group-hover:scale-105"
                unoptimized
              />
            ) : it.kind === 'VIDEO' ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-black/80 px-2 text-white">
                <Play size={20} className="opacity-80" />
                <span className="font-semibold text-[10.5px] uppercase tracking-wide">Video</span>
              </div>
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-paper-2 px-2 text-muted">
                <FileText size={20} />
                <span className="truncate text-[10px]">{it.filename}</span>
              </div>
            )}
          </button>
        ))}
      </div>
      <Lightbox items={items} index={index} onClose={() => setIndex(null)} onChange={setIndex} />
    </>
  );
}
