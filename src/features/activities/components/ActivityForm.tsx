'use client';
import { FormField, FormSection } from '@/components/forms/FormField';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Plus, Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { createActivityAction } from '../actions';
import {
  ACTIVITY_LABELS,
  type ActivityType,
  BATH_TYPES,
  type CreateActivityInput,
  INTAKE,
  ROUTES,
  TESTS,
} from '../schema';

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

export function ActivityForm({ animalId, type, onDone }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const form = useForm<CreateActivityInput>({
    // biome-ignore lint/suspicious/noExplicitAny: discriminated union typing is intentionally relaxed at the form layer
    defaultValues: { animalId, remarks: '', mediaAssetIds: [], ...DEFAULTS[type] } as any,
  });

  const submit = form.handleSubmit((values) => {
    setError(null);
    start(async () => {
      const result = await createActivityAction({
        ...values,
        animalId,
        type,
      } as CreateActivityInput);
      if (!result.ok) setError(result.error ?? 'Failed to log');
      else onDone();
    });
  });

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <FormSection title={ACTIVITY_LABELS[type]}>
        {type === 'TREATMENT' && <TreatmentFields form={form} />}
        {type === 'ROUND' && <RoundFields form={form} />}
        {type === 'DIAGNOSTIC' && <DiagnosticFields form={form} />}
        {type === 'SURGERY' && <SurgeryFields form={form} />}
        {type === 'FOOD' && <FoodFields form={form} />}
        {type === 'BATH' && <BathFields form={form} />}
        {type === 'WALK' && <WalkFields form={form} />}
        {type === 'ADMISSION' && <AdmissionFields form={form} />}
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

// biome-ignore lint/suspicious/noExplicitAny: per-type field components share a relaxed form type
function TreatmentFields({ form }: { form: any }) {
  const { control, register } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'data.meds' });
  return (
    <div className="flex flex-col gap-3">
      {fields.map((f: { id: string }, idx: number) => (
        <div key={f.id} className="grid grid-cols-[1fr_80px_80px_32px] gap-2">
          <Input placeholder="Medicine" {...register(`data.meds.${idx}.name`)} />
          <Input placeholder="Dose" {...register(`data.meds.${idx}.dose`)} />
          <Select {...register(`data.meds.${idx}.route`)}>
            {ROUTES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
          <button
            type="button"
            aria-label="Remove medicine"
            onClick={() => remove(idx)}
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted hover:bg-paper-2"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => append({ name: '', dose: '', route: 'IV' })}
      >
        <Plus size={14} /> Add medicine
      </Button>
    </div>
  );
}

// biome-ignore lint/suspicious/noExplicitAny: shared relaxed form type
function RoundFields({ form }: { form: any }) {
  const { register } = form;
  return (
    <div className="grid grid-cols-2 gap-3">
      <FormField label="Temperature">
        {(id) => <Input id={id} placeholder="101.4°F" {...register('data.temp')} />}
      </FormField>
      <FormField label="Appetite">
        {(id) => <Input id={id} placeholder="Normal / Partial" {...register('data.appetite')} />}
      </FormField>
      <FormField label="Hydration">{(id) => <Input id={id} {...register('data.hydration')} />}</FormField>
      <FormField label="Pain">
        {(id) => <Input id={id} placeholder="3/10" {...register('data.pain')} />}
      </FormField>
      <FormField label="Wound">{(id) => <Input id={id} {...register('data.wound')} />}</FormField>
      <FormField label="Stool / Urine">{(id) => <Input id={id} {...register('data.stool')} />}</FormField>
      <FormField label="Progress">{(id) => <Input id={id} {...register('data.progress')} />}</FormField>
      <FormField label="Instructions">{(id) => <Input id={id} {...register('data.notes')} />}</FormField>
    </div>
  );
}

// biome-ignore lint/suspicious/noExplicitAny: shared relaxed form type
function DiagnosticFields({ form }: { form: any }) {
  const { control, register } = form;
  return (
    <div className="flex flex-col gap-3">
      <FormField label="Tests done">
        <Controller
          control={control}
          name="data.tests"
          render={({ field }) => (
            <div className="flex flex-wrap gap-2">
              {TESTS.map((t) => {
                const checked = (field.value ?? []).includes(t);
                return (
                  <button
                    type="button"
                    key={t}
                    onClick={() =>
                      field.onChange(
                        checked
                          ? (field.value ?? []).filter((x: string) => x !== t)
                          : [...(field.value ?? []), t],
                      )
                    }
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                      checked
                        ? 'border-accent bg-accent-soft text-accent-ink'
                        : 'border-line bg-paper text-muted'
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          )}
        />
      </FormField>
      <FormField label="Findings">
        {(id) => <Textarea id={id} rows={2} {...register('data.findings')} />}
      </FormField>
      <FormField label="Doctor interpretation">
        {(id) => <Textarea id={id} rows={2} {...register('data.interpretation')} />}
      </FormField>
    </div>
  );
}

// biome-ignore lint/suspicious/noExplicitAny: shared relaxed form type
function SurgeryFields({ form }: { form: any }) {
  const { register } = form;
  return (
    <div className="grid grid-cols-2 gap-3">
      <FormField label="Surgery name" required>
        {(id) => <Input id={id} {...register('data.surgeryName')} />}
      </FormField>
      <FormField label="Surgeon" required>
        {(id) => <Input id={id} {...register('data.surgeon')} />}
      </FormField>
      <FormField label="Anesthesia">{(id) => <Input id={id} {...register('data.anesthesia')} />}</FormField>
      <FormField label="Duration">
        {(id) => <Input id={id} placeholder="45 min" {...register('data.duration')} />}
      </FormField>
      <div className="col-span-2">
        <FormField label="Findings">
          {(id) => <Textarea id={id} rows={2} {...register('data.findings')} />}
        </FormField>
      </div>
      <div className="col-span-2">
        <FormField label="Complications">
          {(id) => <Textarea id={id} rows={2} {...register('data.complications')} />}
        </FormField>
      </div>
      <div className="col-span-2">
        <FormField label="Post-op instructions">
          {(id) => <Textarea id={id} rows={2} {...register('data.postOp')} />}
        </FormField>
      </div>
    </div>
  );
}

// biome-ignore lint/suspicious/noExplicitAny: shared relaxed form type
function FoodFields({ form }: { form: any }) {
  const { register } = form;
  return (
    <div className="grid grid-cols-2 gap-3">
      <FormField label="Food type" required>
        {(id) => <Input id={id} placeholder="Curd-rice, veg kibble…" {...register('data.foodType')} />}
      </FormField>
      <FormField label="Quantity">
        {(id) => <Input id={id} placeholder="120g" {...register('data.qty')} />}
      </FormField>
      <FormField label="Water">
        {(id) => <Input id={id} placeholder="180ml" {...register('data.water')} />}
      </FormField>
      <FormField label="Intake" required>
        {(id) => (
          <Select id={id} {...register('data.intake')}>
            {INTAKE.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      <label className="col-span-2 flex items-center gap-2 text-sm">
        <input type="checkbox" {...register('data.vomiting')} className="h-4 w-4 accent-accent" />
        Vomiting after feed
      </label>
    </div>
  );
}

// biome-ignore lint/suspicious/noExplicitAny: shared relaxed form type
function BathFields({ form }: { form: any }) {
  const { register } = form;
  return (
    <div className="flex flex-col gap-3">
      <FormField label="Type" required>
        {(id) => (
          <Select id={id} {...register('data.bathType')}>
            {BATH_TYPES.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      <FormField label="Grooming by">{(id) => <Input id={id} {...register('data.groomingBy')} />}</FormField>
      <FormField label="Remarks">
        {(id) => <Textarea id={id} rows={2} {...register('data.remarks')} />}
      </FormField>
    </div>
  );
}

// biome-ignore lint/suspicious/noExplicitAny: shared relaxed form type
function WalkFields({ form }: { form: any }) {
  const { register } = form;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Duration">
          {(id) => <Input id={id} placeholder="15 min" {...register('data.duration')} />}
        </FormField>
        <FormField label="Mobility">
          {(id) => <Input id={id} placeholder="Mild limp / normal" {...register('data.mobility')} />}
        </FormField>
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" {...register('data.urination')} className="h-4 w-4 accent-accent" />
          Urinated
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" {...register('data.stool')} className="h-4 w-4 accent-accent" />
          Stool passed
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" {...register('data.assisted')} className="h-4 w-4 accent-accent" />
          Assisted
        </label>
      </div>
    </div>
  );
}

// biome-ignore lint/suspicious/noExplicitAny: shared relaxed form type
function AdmissionFields({ form }: { form: any }) {
  const { register } = form;
  return (
    <FormField label="Summary" required>
      {(id) => <Textarea id={id} rows={3} {...register('data.summary')} />}
    </FormField>
  );
}
