'use client';
import { FormField } from '@/components/forms/FormField';
import { Input } from '@/components/ui/Input';
import type { CreateFieldsProps } from '../create-shared';

export function WalkCreateFields({ form }: CreateFieldsProps) {
  const { register } = form;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Duration">
          {(id) => <Input id={id} placeholder="15 min" {...register('data.duration')} />}
        </FormField>
        <FormField label="Mobility">
          {(id) => <Input id={id} placeholder="Mild limp / normal" {...register('data.mobility')} />}
        </FormField>
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" {...register('data.urination')} className="h-4 w-4 accent-accent" />
          Urinated
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" {...register('data.stool')} className="h-4 w-4 accent-accent" />
          Stool passed
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" {...register('data.assisted')} className="h-4 w-4 accent-accent" />
          Assisted
        </label>
      </div>
    </div>
  );
}
