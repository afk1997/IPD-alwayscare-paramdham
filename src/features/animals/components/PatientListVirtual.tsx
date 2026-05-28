'use client';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import type { AnimalListItem } from '../queries';
import { PatientCard } from './PatientCard';

interface Props {
  animals: AnimalListItem[];
}

export function PatientListVirtual({ animals }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const virtualizer = useWindowVirtualizer({
    count: animals.length,
    // PatientCard renders an h-[60px] image + content padding.  The full
    // card is roughly 86–92px tall on mobile; 86 is a good lower-bound
    // estimate, measureElement adapts.
    estimateSize: () => 86,
    overscan: 5,
    scrollMargin: listRef.current?.offsetTop ?? 0,
  });

  return (
    <div ref={listRef} className="relative" style={{ height: `${virtualizer.getTotalSize()}px` }}>
      {virtualizer.getVirtualItems().map((vi) => {
        const animal = animals[vi.index];
        if (!animal) return null;
        return (
          <div
            key={animal.id}
            data-index={vi.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${vi.start - virtualizer.options.scrollMargin}px)`,
            }}
          >
            <div className="pb-2">
              <PatientCard animal={animal} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
