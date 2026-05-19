'use client';
import { FormField } from '@/components/forms/FormField';
import { Textarea } from '@/components/ui/Textarea';
import { Controller } from 'react-hook-form';
import { TESTS } from '../../schema';
import type { CreateFieldsProps } from '../create-shared';

export function DiagnosticCreateFields({ form }: CreateFieldsProps) {
  const { control, register } = form;
  return (
    <div className="flex flex-col gap-3">
      <FormField label="Tests done">
        <Controller
          control={control}
          name="data.tests"
          render={({ field }) => (
            <div className="flex flex-wrap gap-2">
              {TESTS.map((t) => {
                const checked = (field.value ?? []).includes(t);
                return (
                  <button
                    type="button"
                    key={t}
                    onClick={() =>
                      field.onChange(
                        checked
                          ? (field.value ?? []).filter((x: string) => x !== t)
                          : [...(field.value ?? []), t],
                      )
                    }
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                      checked
                        ? 'border-accent bg-accent-soft text-accent-ink'
                        : 'border-line bg-paper text-muted'
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          )}
        />
      </FormField>
      <FormField label="Findings">
        {(id) => <Textarea id={id} rows={2} {...register('data.findings')} />}
      </FormField>
      <FormField label="Doctor interpretation">
        {(id) => <Textarea id={id} rows={2} {...register('data.interpretation')} />}
      </FormField>
    </div>
  );
}
