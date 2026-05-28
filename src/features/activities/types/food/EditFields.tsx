'use client';
import { FormField } from '@/components/forms/FormField';
import { Input } from '@/components/ui/Input';
import { Segmented } from '@/components/ui/Segmented';
import { INTAKE } from '../../schema';
import type { EditFieldsProps } from '../shared';

const VOMITING_OPTIONS = ['No', 'Yes'] as const;

export function FoodEditFields({ value, setData }: EditFieldsProps) {
  return (
    <div className="flex flex-col gap-3">
      <FormField label="Food type" required>
        {(id) => (
          <Input
            id={id}
            value={value.data.foodType ?? ''}
            onChange={(e) => setData({ foodType: e.target.value })}
          />
        )}
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Quantity">
          {(id) => (
            <Input id={id} value={value.data.qty ?? ''} onChange={(e) => setData({ qty: e.target.value })} />
          )}
        </FormField>
        <FormField label="Water">
          {(id) => (
            <Input
              id={id}
              value={value.data.water ?? ''}
              onChange={(e) => setData({ water: e.target.value })}
            />
          )}
        </FormField>
      </div>
      <FormField label="Intake" required>
        <Segmented
          value={(value.data.intake ?? 'Fully') as (typeof INTAKE)[number]}
          onChange={(v) => setData({ intake: v })}
          options={INTAKE}
        />
      </FormField>
      <FormField label="Vomiting after feed">
        <Segmented
          value={value.data.vomiting ? 'Yes' : 'No'}
          onChange={(v) => setData({ vomiting: v === 'Yes' })}
          options={VOMITING_OPTIONS}
        />
      </FormField>
    </div>
  );
}
