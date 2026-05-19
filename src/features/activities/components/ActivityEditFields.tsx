'use client';
import { FormField } from '@/components/forms/FormField';
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

interface Props {
  type: ActivityType;
  value: { remarks: string; data: Data };
  onChange: (next: { remarks: string; data: Data }) => void;
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
  const setData = (patch: Data) => onChange({ remarks: value.remarks, data: { ...value.data, ...patch } });
  const Body = PER_TYPE[type];

  return (
    <div className="flex flex-col gap-4">
      <Body value={{ data: value.data }} setData={setData} />
      <FormField label="Remarks">
        {(id) => (
          <Textarea
            id={id}
            rows={2}
            value={value.remarks}
            onChange={(e) => onChange({ remarks: e.target.value, data: value.data })}
          />
        )}
      </FormField>
    </div>
  );
}
