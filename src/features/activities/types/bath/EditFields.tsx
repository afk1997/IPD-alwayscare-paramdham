'use client';
import { FormField } from '@/components/forms/FormField';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { BATH_TYPES } from '../../schema';
import type { EditFieldsProps } from '../shared';

export function BathEditFields({ value, setData }: EditFieldsProps) {
  const current = (value.data.bathType ?? 'Regular') as (typeof BATH_TYPES)[number];
  return (
    <div className="flex flex-col gap-3">
      <FormField label="Type of bath / grooming" required>
        <div className="flex flex-wrap gap-1.5">
          {BATH_TYPES.map((b) => {
            const active = current === b;
            return (
              <button
                key={b}
                type="button"
                onClick={() => setData({ bathType: b })}
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
