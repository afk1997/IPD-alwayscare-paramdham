'use client';
import { FormField } from '@/components/forms/FormField';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import type { ActivityType } from '../schema';
import { AdmissionEditFields } from '../types/admission/EditFields';
import { BathEditFields } from '../types/bath/EditFields';
import { DiagnosticEditFields } from '../types/diagnostic/EditFields';
import { FoodEditFields } from '../types/food/EditFields';
import { RoundEditFields } from '../types/round/EditFields';
import type { Data, EditFieldsProps } from '../types/shared';
import { SurgeryEditFields } from '../types/surgery/EditFields';
import { TreatmentEditFields } from '../types/treatment/EditFields';
import { WalkEditFields } from '../types/walk/EditFields';

export interface EditDraft {
  remarks: string;
  data: Data;
  occurredAtLocal: string;
  byName: string;
}

interface Props {
  type: ActivityType;
  value: EditDraft;
  onChange: (next: EditDraft) => void;
}

const PER_TYPE: Record<ActivityType, (p: EditFieldsProps) => React.ReactNode> = {
  ADMISSION: AdmissionEditFields,
  TREATMENT: TreatmentEditFields,
  ROUND: RoundEditFields,
  DIAGNOSTIC: DiagnosticEditFields,
  SURGERY: SurgeryEditFields,
  FOOD: FoodEditFields,
  BATH: BathEditFields,
  WALK: WalkEditFields,
};

export function ActivityEditFields({ type, value, onChange }: Props) {
  const setData = (patch: Data) => onChange({ ...value, data: { ...value.data, ...patch } });
  const Body = PER_TYPE[type];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <FormField label="When did this happen?">
          {(id) => (
            <Input
              id={id}
              type="datetime-local"
              value={value.occurredAtLocal}
              onChange={(e) => onChange({ ...value, occurredAtLocal: e.target.value })}
            />
          )}
        </FormField>
        <FormField label="Logged by">
          {(id) => (
            <Input
              id={id}
              value={value.byName}
              onChange={(e) => onChange({ ...value, byName: e.target.value })}
              placeholder="Staff member"
            />
          )}
        </FormField>
      </div>
      <Body value={{ data: value.data }} setData={setData} />
      <FormField label="Remarks">
        {(id) => (
          <Textarea
            id={id}
            rows={2}
            value={value.remarks}
            onChange={(e) => onChange({ ...value, remarks: e.target.value })}
          />
        )}
      </FormField>
    </div>
  );
}

// `<input type="datetime-local">` expects "YYYY-MM-DDTHH:MM" in local time.
export function toLocalDatetime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
