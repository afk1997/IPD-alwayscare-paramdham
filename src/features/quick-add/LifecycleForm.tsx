'use client';
import { DeathForm } from '@/features/animals/lifecycle/components/DeathForm';
import { DischargeForm } from '@/features/animals/lifecycle/components/DischargeForm';
import { useState } from 'react';

type Variant = 'discharge' | 'death';

interface Props {
  animalId: string;
  onDone: () => void;
}

export function LifecycleForm({ animalId, onDone }: Props) {
  const [variant, setVariant] = useState<Variant>('discharge');

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-paper-2 p-1">
        <SegmentButton active={variant === 'discharge'} onClick={() => setVariant('discharge')}>
          Discharge
        </SegmentButton>
        <SegmentButton active={variant === 'death'} onClick={() => setVariant('death')} tone="danger">
          Death
        </SegmentButton>
      </div>
      {variant === 'discharge' ? (
        <DischargeForm animalId={animalId} onDone={onDone} />
      ) : (
        <DeathForm animalId={animalId} onDone={onDone} />
      )}
    </div>
  );
}

interface SegmentProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone?: 'default' | 'danger';
}

function SegmentButton({ active, onClick, children, tone = 'default' }: SegmentProps) {
  const activeClass =
    tone === 'danger' ? 'bg-critical text-white shadow-sm' : 'bg-paper text-accent-ink shadow-sm';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 font-semibold text-[12.5px] transition ${
        active ? activeClass : 'text-muted hover:text-text'
      }`}
    >
      {children}
    </button>
  );
}
