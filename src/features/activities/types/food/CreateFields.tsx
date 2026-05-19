'use client';
import { FormField } from '@/components/forms/FormField';
import { Input } from '@/components/ui/Input';
import { Segmented } from '@/components/ui/Segmented';
import { Controller } from 'react-hook-form';
import { INTAKE } from '../../schema';
import type { CreateFieldsProps } from '../create-shared';

export function FoodCreateFields({ form }: CreateFieldsProps) {
  const { register, control } = form;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Food type" required>
          {(id) => <Input id={id} placeholder="Curd-rice, veg kibble…" {...register('data.foodType')} />}
        </FormField>
        <FormField label="Quantity">
          {(id) => <Input id={id} placeholder="120g" {...register('data.qty')} />}
        </FormField>
        <FormField label="Water">
          {(id) => <Input id={id} placeholder="180ml" {...register('data.water')} />}
        </FormField>
      </div>
      <FormField label="Intake" required>
        <Controller
          control={control}
          name="data.intake"
          render={({ field }) => (
            <Segmented value={field.value ?? 'Fully'} onChange={field.onChange} options={INTAKE} />
          )}
        />
      </FormField>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...register('data.vomiting')} className="h-4 w-4 accent-accent" />
        Vomiting after feed
      </label>
    </div>
  );
}
