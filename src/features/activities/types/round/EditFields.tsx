'use client';
import { FormField } from '@/components/forms/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import type { EditFieldsProps } from '../shared';

const APPETITE = ['Normal', 'Partial', 'Refused'] as const;
const HYDRATION = ['Good', 'OK', 'Mild', 'Severe'] as const;
const PROGRESS = ['Worsening', 'Stable', 'Improving', 'Recovered'] as const;

export function RoundEditFields({ value, setData }: EditFieldsProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <FormField label="Temperature (°F)">
        {(id) => (
          <Input id={id} value={value.data.temp ?? ''} onChange={(e) => setData({ temp: e.target.value })} />
        )}
      </FormField>
      <FormField label="Pain">
        {(id) => (
          <Input
            id={id}
            value={value.data.pain ?? ''}
            onChange={(e) => setData({ pain: e.target.value })}
            placeholder="0/10 – 10/10"
          />
        )}
      </FormField>
      <PickField label="Appetite" options={APPETITE} field="appetite" value={value} setData={setData} />
      <PickField label="Hydration" options={HYDRATION} field="hydration" value={value} setData={setData} />
      <FormField label="Wound">
        {(id) => (
          <Input
            id={id}
            value={value.data.wound ?? ''}
            onChange={(e) => setData({ wound: e.target.value })}
          />
        )}
      </FormField>
      <FormField label="Stool / Urine">
        {(id) => (
          <Input
            id={id}
            value={value.data.stool ?? ''}
            onChange={(e) => setData({ stool: e.target.value })}
          />
        )}
      </FormField>
      <div className="col-span-2">
        <PickField label="Progress" options={PROGRESS} field="progress" value={value} setData={setData} />
      </div>
      <div className="col-span-2">
        <FormField label="Instructions / Notes">
          {(id) => (
            <Textarea
              id={id}
              rows={2}
              value={value.data.notes ?? ''}
              onChange={(e) => setData({ notes: e.target.value })}
            />
          )}
        </FormField>
      </div>
    </div>
  );
}

interface PickProps extends EditFieldsProps {
  label: string;
  options: readonly string[];
  field: string;
}

function PickField({ label, options, field, value, setData }: PickProps) {
  return (
    <FormField label={label}>
      {(id) => (
        <Select
          id={id}
          value={value.data[field] ?? ''}
          onChange={(e) => setData({ [field]: e.target.value })}
        >
          <option value="">—</option>
          {options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </Select>
      )}
    </FormField>
  );
}
