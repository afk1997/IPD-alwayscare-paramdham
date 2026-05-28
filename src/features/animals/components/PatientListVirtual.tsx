'use client';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import type { AnimalListItem } from '../queries';
import { PatientCard } from './PatientCard';

interface Props {
  animals: AnimalListItem[];
}

export function PatientListVirtual({ animals }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: animals.length,
    getScrollElement: () => parentRef.current,
    // PatientCard renders an h-[60px] image + content padding.  The full
    // card is roughly 86–92px tall on mobile; 86 is a good lower-bound
    // estimate, measureElement adapts.
    estimateSize: () => 86,
    overscan: 6,
  });

  return (
    <div ref={parentRef} className="max-h-[78vh] overflow-y-auto md:max-h-[80vh]">
      <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
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
                transform: `translateY(${vi.start}px)`,
              }}
            >
              <div className="pb-2">
                <PatientCard animal={animal} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
