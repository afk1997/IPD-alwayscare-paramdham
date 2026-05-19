'use client';
import { FormField } from '@/components/forms/FormField';
import { Input } from '@/components/ui/Input';
import { Segmented } from '@/components/ui/Segmented';
import { Controller } from 'react-hook-form';
import { APPETITE_OPTIONS, HYDRATION_OPTIONS, PROGRESS_OPTIONS } from '../../schema';
import type { CreateFieldsProps } from '../create-shared';

export function RoundCreateFields({ form }: CreateFieldsProps) {
  const { register, control } = form;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Temperature">
          {(id) => <Input id={id} placeholder="101.4°F" {...register('data.temp')} />}
        </FormField>
        <FormField label="Pain">
          {(id) => <Input id={id} placeholder="3/10" {...register('data.pain')} />}
        </FormField>
      </div>
      <FormField label="Appetite">
        <Controller
          control={control}
          name="data.appetite"
          render={({ field }) => (
            <Segmented
              value={field.value ?? ''}
              onChange={field.onChange}
              options={APPETITE_OPTIONS}
              allowEmpty
            />
          )}
        />
      </FormField>
      <FormField label="Hydration">
        <Controller
          control={control}
          name="data.hydration"
          render={({ field }) => (
            <Segmented
              value={field.value ?? ''}
              onChange={field.onChange}
              options={HYDRATION_OPTIONS}
              allowEmpty
            />
          )}
        />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Wound">{(id) => <Input id={id} {...register('data.wound')} />}</FormField>
        <FormField label="Stool / Urine">{(id) => <Input id={id} {...register('data.stool')} />}</FormField>
      </div>
      <FormField label="Progress">
        <Controller
          control={control}
          name="data.progress"
          render={({ field }) => (
            <Segmented
              value={field.value ?? ''}
              onChange={field.onChange}
              options={PROGRESS_OPTIONS}
              allowEmpty
            />
          )}
        />
      </FormField>
      <FormField label="Instructions">{(id) => <Input id={id} {...register('data.notes')} />}</FormField>
    </div>
  );
}
