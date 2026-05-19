'use client';
import { FormField } from '@/components/forms/FormField';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Controller } from 'react-hook-form';
import { BATH_TYPES } from '../../schema';
import type { CreateFieldsProps } from '../create-shared';

export function BathCreateFields({ form }: CreateFieldsProps) {
  const { register, control } = form;
  return (
    <div className="flex flex-col gap-3">
      <FormField label="Type of bath / grooming" required>
        <Controller
          control={control}
          name="data.bathType"
          render={({ field }) => (
            <div className="flex flex-wrap gap-1.5">
              {BATH_TYPES.map((b) => {
                const active = field.value === b;
                return (
                  <button
                    key={b}
                    type="button"
                    onClick={() => field.onChange(b)}
                    className={`rounded-full border px-3 py-1.5 font-semibold text-[12.5px] transition ${
                      active
                        ? 'border-accent bg-accent text-accent-fg'
                        : 'border-line bg-paper text-muted hover:bg-paper-2'
                    }`}
                  >
                    {b}
                  </button>
                );
              })}
            </div>
          )}
        />
      </FormField>
      <FormField label="Grooming by">{(id) => <Input id={id} {...register('data.groomingBy')} />}</FormField>
      <FormField label="Remarks">
        {(id) => <Textarea id={id} rows={2} {...register('data.remarks')} />}
      </FormField>
    </div>
  );
}
