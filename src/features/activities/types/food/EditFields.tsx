'use client';
import { FormField } from '@/components/forms/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { INTAKE } from '../../schema';
import type { EditFieldsProps } from '../shared';

export function FoodEditFields({ value, setData }: EditFieldsProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <FormField label="Food type" required>
          {(id) => (
            <Input
              id={id}
              value={value.data.foodType ?? ''}
              onChange={(e) => setData({ foodType: e.target.value })}
            />
          )}
        </FormField>
      </div>
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
      <FormField label="Intake">
        {(id) => (
          <Select
            id={id}
            value={value.data.intake ?? 'Fully'}
            onChange={(e) => setData({ intake: e.target.value })}
          >
            {INTAKE.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      <label className="col-span-2 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={!!value.data.vomiting}
          onChange={(e) => setData({ vomiting: e.target.checked })}
          className="h-4 w-4 accent-accent"
        />
        Vomiting after feed
      </label>
    </div>
  );
}
