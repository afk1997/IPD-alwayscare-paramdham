'use client';
import { FormField } from '@/components/forms/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { EditFieldsProps } from '../shared';

const MOBILITY = ['Normal', 'Mild limp', 'Severe limp', 'Unable'] as const;

export function WalkEditFields({ value, setData }: EditFieldsProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
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
          {(id) => (
            <Select
              id={id}
              value={value.data.mobility ?? ''}
              onChange={(e) => setData({ mobility: e.target.value })}
            >
              <option value="">—</option>
              {MOBILITY.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
          )}
        </FormField>
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <Toggle field="urination" label="Urinated" value={value} setData={setData} />
        <Toggle field="stool" label="Stool passed" value={value} setData={setData} />
        <Toggle field="assisted" label="Assisted" value={value} setData={setData} />
      </div>
    </div>
  );
}

interface ToggleProps extends EditFieldsProps {
  field: string;
  label: string;
}

function Toggle({ field, label, value, setData }: ToggleProps) {
  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={!!value.data[field]}
        onChange={(e) => setData({ [field]: e.target.checked })}
        className="h-4 w-4 accent-accent"
      />
      {label}
    </label>
  );
}
