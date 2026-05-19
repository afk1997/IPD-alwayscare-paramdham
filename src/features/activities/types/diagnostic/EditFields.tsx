'use client';
import { FormField } from '@/components/forms/FormField';
import { Textarea } from '@/components/ui/Textarea';
import { TESTS } from '../../schema';
import { ChipMulti, type EditFieldsProps } from '../shared';

export function DiagnosticEditFields({ value, setData }: EditFieldsProps) {
  return (
    <div className="flex flex-col gap-3">
      <FormField label="Tests done">
        <ChipMulti options={TESTS} value={value.data.tests ?? []} onChange={(tests) => setData({ tests })} />
      </FormField>
      <FormField label="Findings">
        {(id) => (
          <Textarea
            id={id}
            rows={2}
            value={value.data.findings ?? ''}
            onChange={(e) => setData({ findings: e.target.value })}
          />
        )}
      </FormField>
      <FormField label="Doctor interpretation">
        {(id) => (
          <Textarea
            id={id}
            rows={2}
            value={value.data.interpretation ?? ''}
            onChange={(e) => setData({ interpretation: e.target.value })}
          />
        )}
      </FormField>
    </div>
  );
}
