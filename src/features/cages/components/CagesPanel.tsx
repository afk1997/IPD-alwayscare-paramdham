'use client';
import { useState } from 'react';
import type { CageRow } from '../actions';
import { AddCageForm } from './AddCageForm';
import { CageList } from './CageList';

interface Props {
  initial: CageRow[];
}

export function CagesPanel({ initial }: Props) {
  const [cages, setCages] = useState<CageRow[]>(initial);

  const onCreated = (c: CageRow) => {
    setCages((prev) => [...prev, c].sort((a, b) => a.name.localeCompare(b.name)));
  };
  const onRenamed = (c: CageRow) => {
    setCages((prev) => prev.map((x) => (x.id === c.id ? c : x)).sort((a, b) => a.name.localeCompare(b.name)));
  };
  const onDeleted = (id: string) => {
    setCages((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="flex flex-col gap-5">
      <AddCageForm onCreated={onCreated} />
      <CageList cages={cages} onRenamed={onRenamed} onDeleted={onDeleted} />
    </div>
  );
}
