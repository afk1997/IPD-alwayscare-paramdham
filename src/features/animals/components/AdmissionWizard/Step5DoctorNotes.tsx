'use client';
import { FormField, FormSection } from '@/components/forms/FormField';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Controller, type UseFormReturn } from 'react-hook-form';
import { type CreateAnimalInput, TEST_KINDS } from '../../schema';

interface Props {
  form: UseFormReturn<CreateAnimalInput>;
}

const TEST_LABELS: Record<(typeof TEST_KINDS)[number], string> = {
  XRAY: 'X-ray',
  USG: 'USG',
  BLOOD_TEST: 'Blood test',
  MRI: 'MRI',
  CT_SCAN: 'CT scan',
  SONOGRAPHY: 'Sonography',
};

export function Step5DoctorNotes({ form }: Props) {
  const { register, control } = form;
  return (
    <FormSection title="Doctor's initial notes" description="Set up the plan of care">
      <FormField label="Tentative diagnosis" htmlFor="diagnosis">
        <Textarea id="diagnosis" rows={3} {...register('diagnosis')} />
      </FormField>
      <FormField label="Surgery required?" htmlFor="surgeryRequired" hint="No / Yes / Maybe — and notes">
        <Input id="surgeryRequired" {...register('surgeryRequired')} />
      </FormField>
      <FormField label="Tests advised">
        <Controller
          control={control}
          name="testsAdvised"
          render={({ field }) => (
            <div className="flex flex-wrap gap-2">
              {TEST_KINDS.map((t) => {
                const checked = field.value.includes(t);
                return (
                  <button
                    type="button"
                    key={t}
                    onClick={() =>
                      field.onChange(checked ? field.value.filter((x) => x !== t) : [...field.value, t])
                    }
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      checked
                        ? 'border-accent bg-accent-soft text-accent-ink'
                        : 'border-line bg-paper text-muted hover:bg-paper-2'
                    }`}
                  >
                    {TEST_LABELS[t]}
                  </button>
                );
              })}
            </div>
          )}
        />
      </FormField>
    </FormSection>
  );
}
