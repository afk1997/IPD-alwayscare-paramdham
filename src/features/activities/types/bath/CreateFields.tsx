'use client';
import { FormField } from '@/components/forms/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { BATH_TYPES } from '../../schema';
import type { CreateFieldsProps } from '../create-shared';

export function BathCreateFields({ form }: CreateFieldsProps) {
  const { register } = form;
  return (
    <div className="flex flex-col gap-3">
      <FormField label="Type" required>
        {(id) => (
          <Select id={id} {...register('data.bathType')}>
            {BATH_TYPES.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      <FormField label="Grooming by">{(id) => <Input id={id} {...register('data.groomingBy')} />}</FormField>
      <FormField label="Remarks">
        {(id) => <Textarea id={id} rows={2} {...register('data.remarks')} />}
      </FormField>
    </div>
  );
}
