'use client';
import { FormField } from '@/components/forms/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { BATH_TYPES } from '../../schema';
import type { EditFieldsProps } from '../shared';

export function BathEditFields({ value, setData }: EditFieldsProps) {
  return (
    <div className="flex flex-col gap-3">
      <FormField label="Type" required>
        {(id) => (
          <Select
            id={id}
            value={value.data.bathType ?? 'Regular'}
            onChange={(e) => setData({ bathType: e.target.value })}
          >
            {BATH_TYPES.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      <FormField label="Grooming by">
        {(id) => (
          <Input
            id={id}
            value={value.data.groomingBy ?? ''}
            onChange={(e) => setData({ groomingBy: e.target.value })}
          />
        )}
      </FormField>
      <FormField label="Remarks">
        {(id) => (
          <Textarea
            id={id}
            rows={2}
            value={value.data.remarks ?? ''}
            onChange={(e) => setData({ remarks: e.target.value })}
          />
        )}
      </FormField>
    </div>
  );
}
