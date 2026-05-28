'use client';
import { FormField, FormSection } from '@/components/forms/FormField';
import { MediaUploader, type UploadedAsset } from '@/components/media/MediaUploader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { useActiveUsers } from '@/features/users/ActiveUsersContext';
import { copyToClipboard } from '@/lib/clipboard';
import { useMemo, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { createActivityAction, getActivityShareTextAction } from '../actions';
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

// `<input type="datetime-local">` wants "YYYY-MM-DDTHH:MM" in *local* time.
function localDatetimeInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ActivityForm({ animalId, type, onDone }: Props) {
  const { showToast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [media, setMedia] = useState<UploadedAsset[]>([]);
  const [occurredAtLocal, setOccurredAtLocal] = useState(() => localDatetimeInputValue(new Date()));
  const { users: activeUsers, currentUserId, currentUserName } = useActiveUsers();
  const [byNameSelected, setByNameSelected] = useState(currentUserName);
  // Memoise the <option> list so React doesn't rebuild it on every
  // keystroke in the other fields.  If the current user isn't in
  // activeUsers (e.g. SUPER_ADMIN — filtered out of the Logged-by
  // dropdown), prepend a self-option so the Select has a valid initial
  // value.  Dedup by *id* not name: usernames aren't unique in the
  // schema, so name-based dedup would silently drop the SUPER_ADMIN's
  // self-option whenever a STAFF/DOCTOR shares their name.
  const loggedByOptions = useMemo(() => {
    const selfInList = activeUsers.some((u) => u.id === currentUserId);
    const withSelf = selfInList
      ? activeUsers
      : [{ id: currentUserId, name: currentUserName }, ...activeUsers];
    return withSelf.map((u) => (
      <option key={u.id} value={u.name}>
        {u.name}
      </option>
    ));
  }, [activeUsers, currentUserId, currentUserName]);

  const form = useForm<CreateActivityInput>({
    // biome-ignore lint/suspicious/noExplicitAny: discriminated union typing is intentionally relaxed at the form layer
    defaultValues: { animalId, remarks: '', mediaAssetIds: [], ...DEFAULTS[type] } as any,
  });
  const Body = PER_TYPE[type];

  // Stable upload-context timestamp — picked at mount so the Drive folder
  // for this in-progress activity stays consistent across multiple file
  // picks even if the user later changes `occurredAt`.
  const uploadOccurredAt = useMemo(() => new Date().toISOString(), []);

  const submit = form.handleSubmit((values) => {
    setError(null);
    start(async () => {
      // datetime-local emits local time; new Date() interprets it as local
      // and toISOString() normalises to UTC for the server.
      const occurredAtISO = occurredAtLocal ? new Date(occurredAtLocal).toISOString() : undefined;
      const result = await createActivityAction({
        ...values,
        animalId,
        type,
        mediaAssetIds: media.map((m) => m.id),
        occurredAt: occurredAtISO,
        byName: byNameSelected,
      } as CreateActivityInput);
      if (!result.ok) {
        setError(result.error ?? 'Failed to log');
        return;
      }

      // Fetch the formatted share-text and attach it as a Share action
      // on the success toast.  If the fetch fails for any reason the
      // form still closes with a plain "saved" toast.
      const activityId = result.activity?.id;
      const share = activityId ? await getActivityShareTextAction(activityId) : null;
      const shareText = share?.ok ? share.text : undefined;
      showToast({
        message: `${ACTIVITY_LABELS[type]} saved`,
        duration: 8000,
        ...(shareText
          ? {
              action: {
                label: 'Share',
                onClick: () =>
                  copyToClipboard(shareText, {
                    onSuccess: () =>
                      showToast({ message: 'Activity copied — paste in WhatsApp / Slack / etc.' }),
                    onFallback: () => showToast({ message: 'Activity copied (fallback)' }),
                  }),
              },
            }
          : {}),
      });
      onDone();
    });
  });

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <FormSection title={ACTIVITY_LABELS[type]}>
        <FormField
          label="When did this happen?"
          hint={'Defaults to now (your timezone) — adjust to back-fill missed entries'}
        >
          {(id) => (
            <Input
              id={id}
              type="datetime-local"
              value={occurredAtLocal}
              onChange={(e) => setOccurredAtLocal(e.target.value)}
              max={localDatetimeInputValue(new Date())}
            />
          )}
        </FormField>
        <Body form={form} />
        <FormField label="Remarks">
          {(id) => <Textarea id={id} rows={2} {...form.register('remarks')} />}
        </FormField>
        <FormField
          label="Logged by"
          required
          hint="Defaults to your name — pick someone else if logging on their behalf"
        >
          {(id) => (
            <Select
              id={id}
              required
              value={byNameSelected}
              onChange={(e) => setByNameSelected(e.target.value)}
            >
              {loggedByOptions}
            </Select>
          )}
        </FormField>
        <MediaUploader
          value={media}
          onChange={setMedia}
          context={{ kind: 'activity', animalId, activityType: type, occurredAt: uploadOccurredAt }}
          label={MEDIA_LABEL[type]}
        />
      </FormSection>
      {error && (
        <div role="alert" className="text-critical text-sm">
          {error}
        </div>
      )}
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
