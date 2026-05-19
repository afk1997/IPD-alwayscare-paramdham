'use client';
import { FormField } from '@/components/forms/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { INTAKE } from '../../schema';
import type { CreateFieldsProps } from '../create-shared';

export function FoodCreateFields({ form }: CreateFieldsProps) {
  const { register } = form;
  return (
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
      <FormField label="Intake" required>
        {(id) => (
          <Select id={id} {...register('data.intake')}>
            {INTAKE.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      <label className="col-span-2 flex items-center gap-2 text-sm">
        <input type="checkbox" {...register('data.vomiting')} className="h-4 w-4 accent-accent" />
        Vomiting after feed
      </label>
    </div>
  );
}
