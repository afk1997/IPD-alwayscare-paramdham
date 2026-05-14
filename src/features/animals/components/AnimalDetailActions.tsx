'use client';
import { Button } from '@/components/ui/Button';
import { ActivityQuickAdd } from '@/features/activities/components/ActivityQuickAdd';
import { Plus } from 'lucide-react';
import { useState } from 'react';

interface Props {
  animalId: string;
}

export function AnimalDetailActions({ animalId }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus size={14} />
        Log activity
      </Button>
      <ActivityQuickAdd animalId={animalId} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
