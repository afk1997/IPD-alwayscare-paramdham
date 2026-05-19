'use client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Plus, Trash2 } from 'lucide-react';
import { useFieldArray } from 'react-hook-form';
import { ROUTES } from '../../schema';
import type { CreateFieldsProps } from '../create-shared';

export function TreatmentCreateFields({ form }: CreateFieldsProps) {
  const { control, register } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'data.meds' });
  return (
    <div className="flex flex-col gap-3">
      {fields.map((f: { id: string }, idx: number) => (
        <div key={f.id} className="grid grid-cols-[1fr_80px_80px_32px] gap-2">
          <Input placeholder="Medicine" {...register(`data.meds.${idx}.name`)} />
          <Input placeholder="Dose" {...register(`data.meds.${idx}.dose`)} />
          <Select {...register(`data.meds.${idx}.route`)}>
            {ROUTES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
          <button
            type="button"
            aria-label="Remove medicine"
            onClick={() => remove(idx)}
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted hover:bg-paper-2"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => append({ name: '', dose: '', route: 'IV' })}
      >
        <Plus size={14} /> Add medicine
      </Button>
    </div>
  );
}
