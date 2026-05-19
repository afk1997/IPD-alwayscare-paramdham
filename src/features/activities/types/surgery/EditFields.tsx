'use client';
import { FormField } from '@/components/forms/FormField';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import type { EditFieldsProps } from '../shared';

export function SurgeryEditFields({ value, setData }: EditFieldsProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <FormField label="Surgery name" required>
          {(id) => (
            <Input
              id={id}
              value={value.data.surgeryName ?? ''}
              onChange={(e) => setData({ surgeryName: e.target.value })}
            />
          )}
        </FormField>
      </div>
      <FormField label="Surgeon" required>
        {(id) => (
          <Input
            id={id}
            value={value.data.surgeon ?? ''}
            onChange={(e) => setData({ surgeon: e.target.value })}
          />
        )}
      </FormField>
      <FormField label="Duration">
        {(id) => (
          <Input
            id={id}
            value={value.data.duration ?? ''}
            onChange={(e) => setData({ duration: e.target.value })}
            placeholder="45 min"
          />
        )}
      </FormField>
      <div className="col-span-2">
        <FormField label="Anesthesia">
          {(id) => (
            <Input
              id={id}
              value={value.data.anesthesia ?? ''}
              onChange={(e) => setData({ anesthesia: e.target.value })}
            />
          )}
        </FormField>
      </div>
      <FullArea label="Findings" field="findings" value={value} setData={setData} />
      <FullArea label="Complications" field="complications" value={value} setData={setData} />
      <FullArea label="Post-op instructions" field="postOp" value={value} setData={setData} />
    </div>
  );
}

interface FullAreaProps extends EditFieldsProps {
  label: string;
  field: string;
}

function FullArea({ label, field, value, setData }: FullAreaProps) {
  return (
    <div className="col-span-2">
      <FormField label={label}>
        {(id) => (
          <Textarea
            id={id}
            rows={2}
            value={value.data[field] ?? ''}
            onChange={(e) => setData({ [field]: e.target.value })}
          />
        )}
      </FormField>
    </div>
  );
}
