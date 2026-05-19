'use client';
import { FormField, FormSection } from '@/components/forms/FormField';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { createActivityAction } from '../actions';
import { ACTIVITY_LABELS, type ActivityType, type CreateActivityInput } from '../schema';
import { AdmissionCreateFields } from '../types/admission/CreateFields';
import { BathCreateFields } from '../types/bath/CreateFields';
import type { CreateFieldsProps } from '../types/create-shared';
import { DiagnosticCreateFields } from '../types/diagnostic/CreateFields';
import { FoodCreateFields } from '../types/food/CreateFields';
import { RoundCreateFields } from '../types/round/CreateFields';
import { SurgeryCreateFields } from '../types/surgery/CreateFields';
import { TreatmentCreateFields } from '../types/treatment/CreateFields';
import { WalkCreateFields } from '../types/walk/CreateFields';

interface Props {
  animalId: string;
  type: ActivityType;
  onDone: () => void;
}

const DEFAULTS: Record<ActivityType, Partial<CreateActivityInput>> = {
  ADMISSION: { type: 'ADMISSION', data: { summary: '' } },
  TREATMENT: { type: 'TREATMENT', data: { meds: [{ name: '', dose: '', route: 'IV' }] } },
  ROUND: { type: 'ROUND', data: {} },
  DIAGNOSTIC: { type: 'DIAGNOSTIC', data: { tests: [] } },
  SURGERY: { type: 'SURGERY', data: { surgeryName: '', surgeon: '' } },
  FOOD: { type: 'FOOD', data: { foodType: '', intake: 'Fully', vomiting: false } },
  BATH: { type: 'BATH', data: { bathType: 'Regular' } },
  WALK: { type: 'WALK', data: { urination: false, stool: false, assisted: false } },
};

const PER_TYPE: Record<ActivityType, (p: CreateFieldsProps) => React.ReactNode> = {
  ADMISSION: AdmissionCreateFields,
  TREATMENT: TreatmentCreateFields,
  ROUND: RoundCreateFields,
  DIAGNOSTIC: DiagnosticCreateFields,
  SURGERY: SurgeryCreateFields,
  FOOD: FoodCreateFields,
  BATH: BathCreateFields,
  WALK: WalkCreateFields,
};

export function ActivityForm({ animalId, type, onDone }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const form = useForm<CreateActivityInput>({
    // biome-ignore lint/suspicious/noExplicitAny: discriminated union typing is intentionally relaxed at the form layer
    defaultValues: { animalId, remarks: '', mediaAssetIds: [], ...DEFAULTS[type] } as any,
  });
  const Body = PER_TYPE[type];

  const submit = form.handleSubmit((values) => {
    setError(null);
    start(async () => {
      const result = await createActivityAction({ ...values, animalId, type } as CreateActivityInput);
      if (!result.ok) setError(result.error ?? 'Failed to log');
      else onDone();
    });
  });

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <FormSection title={ACTIVITY_LABELS[type]}>
        <Body form={form} />
        <FormField label="Remarks">
          {(id) => <Textarea id={id} rows={2} {...form.register('remarks')} />}
        </FormField>
      </FormSection>
      {error && <div className="text-sm text-critical">{error}</div>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save entry'}
        </Button>
      </div>
    </form>
  );
}
