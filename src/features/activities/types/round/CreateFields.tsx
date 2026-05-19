'use client';
import { FormField } from '@/components/forms/FormField';
import { Input } from '@/components/ui/Input';
import type { CreateFieldsProps } from '../create-shared';

export function RoundCreateFields({ form }: CreateFieldsProps) {
  const { register } = form;
  return (
    <div className="grid grid-cols-2 gap-3">
      <FormField label="Temperature">
        {(id) => <Input id={id} placeholder="101.4°F" {...register('data.temp')} />}
      </FormField>
      <FormField label="Appetite">
        {(id) => <Input id={id} placeholder="Normal / Partial" {...register('data.appetite')} />}
      </FormField>
      <FormField label="Hydration">{(id) => <Input id={id} {...register('data.hydration')} />}</FormField>
      <FormField label="Pain">
        {(id) => <Input id={id} placeholder="3/10" {...register('data.pain')} />}
      </FormField>
      <FormField label="Wound">{(id) => <Input id={id} {...register('data.wound')} />}</FormField>
      <FormField label="Stool / Urine">{(id) => <Input id={id} {...register('data.stool')} />}</FormField>
      <FormField label="Progress">{(id) => <Input id={id} {...register('data.progress')} />}</FormField>
      <FormField label="Instructions">{(id) => <Input id={id} {...register('data.notes')} />}</FormField>
    </div>
  );
}
