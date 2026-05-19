'use client';
import { FormField } from '@/components/forms/FormField';
import { Input } from '@/components/ui/Input';
import { Segmented } from '@/components/ui/Segmented';
import { Controller } from 'react-hook-form';
import { MOBILITY_OPTIONS } from '../../schema';
import type { CreateFieldsProps } from '../create-shared';

const MOVEMENT_OPTIONS = [
  { value: 'independent', label: 'Independent' },
  { value: 'assisted', label: 'Assisted' },
] as const;

export function WalkCreateFields({ form }: CreateFieldsProps) {
  const { register, control } = form;
  return (
    <div className="flex flex-col gap-3">
      <FormField label="Duration">
        {(id) => <Input id={id} placeholder="15 min" {...register('data.duration')} />}
      </FormField>
      <FormField label="Mobility">
        <Controller
          control={control}
          name="data.mobility"
          render={({ field }) => (
            <Segmented
              value={field.value ?? ''}
              onChange={field.onChange}
              options={MOBILITY_OPTIONS}
              allowEmpty
            />
          )}
        />
      </FormField>
      <FormField label="Movement">
        <Controller
          control={control}
          name="data.assisted"
          render={({ field }) => (
            <Segmented
              value={field.value ? 'assisted' : 'independent'}
              onChange={(v) => field.onChange(v === 'assisted')}
              options={MOVEMENT_OPTIONS}
            />
          )}
        />
      </FormField>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" {...register('data.urination')} className="h-4 w-4 accent-accent" />
          Urinated
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" {...register('data.stool')} className="h-4 w-4 accent-accent" />
          Stool passed
        </label>
      </div>
    </div>
  );
}
