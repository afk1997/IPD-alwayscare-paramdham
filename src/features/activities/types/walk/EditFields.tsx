'use client';
import { FormField } from '@/components/forms/FormField';
import { Input } from '@/components/ui/Input';
import { Segmented } from '@/components/ui/Segmented';
import { MOBILITY_OPTIONS } from '../../schema';
import type { EditFieldsProps } from '../shared';

const MOVEMENT_OPTIONS = [
  { value: 'independent', label: 'Independent' },
  { value: 'assisted', label: 'Assisted' },
] as const;

export function WalkEditFields({ value, setData }: EditFieldsProps) {
  return (
    <div className="flex flex-col gap-3">
      <FormField label="Duration">
        {(id) => (
          <Input
            id={id}
            value={value.data.duration ?? ''}
            onChange={(e) => setData({ duration: e.target.value })}
          />
        )}
      </FormField>
      <FormField label="Mobility">
        <Segmented
          value={value.data.mobility ?? ''}
          onChange={(v) => setData({ mobility: v })}
          options={MOBILITY_OPTIONS}
          allowEmpty
        />
      </FormField>
      <FormField label="Movement">
        <Segmented
          value={value.data.assisted ? 'assisted' : 'independent'}
          onChange={(v) => setData({ assisted: v === 'assisted' })}
          options={MOVEMENT_OPTIONS}
        />
      </FormField>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!value.data.urination}
            onChange={(e) => setData({ urination: e.target.checked })}
            className="h-4 w-4 accent-accent"
          />
          Urinated
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!value.data.stool}
            onChange={(e) => setData({ stool: e.target.checked })}
            className="h-4 w-4 accent-accent"
          />
          Stool passed
        </label>
      </div>
    </div>
  );
}
