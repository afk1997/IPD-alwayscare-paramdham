'use client';
import { FormField, FormSection } from '@/components/forms/FormField';
import { MediaUploader, type UploadedAsset } from '@/components/media/MediaUploader';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { useMemo, useState, useTransition } from 'react';
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

// Per-type media labels, mirroring the HTML mockup copy.
const MEDIA_LABEL: Record<ActivityType, string> = {
  ADMISSION: 'Admission photos & videos',
  TREATMENT: 'Attach proof photo',
  ROUND: 'Attach round photo',
  DIAGNOSTIC: 'Upload reports / x-rays',
  SURGERY: 'OT photos · consent forms · surgical notes',
  FOOD: 'Bowl / feeding photo',
  BATH: 'Before / after photo',
  WALK: 'Walk photo',
};

export function ActivityForm({ animalId, type, onDone }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [media, setMedia] = useState<UploadedAsset[]>([]);
  const form = useForm<CreateActivityInput>({
    // biome-ignore lint/suspicious/noExplicitAny: discriminated union typing is intentionally relaxed at the form layer
    defaultValues: { animalId, remarks: '', mediaAssetIds: [], ...DEFAULTS[type] } as any,
  });
  const Body = PER_TYPE[type];

  // Stable `occurredAt` for the upload context — picked at mount so the
  // Drive folder for this in-progress activity stays consistent across
  // multiple file picks. The server will stamp the real occurredAt at
  // create time.
  const occurredAt = useMemo(() => new Date().toISOString(), []);

  const submit = form.handleSubmit((values) => {
    setError(null);
    start(async () => {
      const result = await createActivityAction({
        ...values,
        animalId,
        type,
        mediaAssetIds: media.map((m) => m.id),
      } as CreateActivityInput);
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
        <MediaUploader
          value={media}
          onChange={setMedia}
          context={{ kind: 'activity', animalId, activityType: type, occurredAt }}
          label={MEDIA_LABEL[type]}
        />
      </FormSection>
      {error && <div className="text-critical text-sm">{error}</div>}
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
