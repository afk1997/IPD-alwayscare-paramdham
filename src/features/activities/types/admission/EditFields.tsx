'use client';
import { FormField } from '@/components/forms/FormField';
import { Textarea } from '@/components/ui/Textarea';
import type { EditFieldsProps } from '../shared';

export function AdmissionEditFields({ value, setData }: EditFieldsProps) {
  return (
    <FormField label="Summary" required>
      {(id) => (
        <Textarea
          id={id}
          rows={3}
          value={value.data.summary ?? ''}
          onChange={(e) => setData({ summary: e.target.value })}
        />
      )}
    </FormField>
  );
}
