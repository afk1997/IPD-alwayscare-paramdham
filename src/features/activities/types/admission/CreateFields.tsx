'use client';
import { FormField } from '@/components/forms/FormField';
import { Textarea } from '@/components/ui/Textarea';
import type { CreateFieldsProps } from '../create-shared';

export function AdmissionCreateFields({ form }: CreateFieldsProps) {
  return (
    <FormField label="Summary" required>
      {(id) => <Textarea id={id} rows={3} {...form.register('data.summary')} />}
    </FormField>
  );
}
