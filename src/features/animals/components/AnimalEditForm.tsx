'use client';
import { FormField, FormSection } from '@/components/forms/FormField';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { updateAnimalAction } from '../actions';
import { STATUSES, VACCINATION } from '../schema';

interface Props {
  animal: {
    id: string;
    name: string;
    breed: string | null;
    ageText: string | null;
    color: string | null;
    weightKg: string | null;
    vaccination: string;
    sterilized: boolean;
    aggressive: boolean;
    contagious: boolean;
    ward: string | null;
    status: string;
    complaint: string | null;
    history: string | null;
    injuryType: string | null;
    diagnosis: string | null;
    immediateTreatment: string | null;
    surgeryRequired: string | null;
    rescuer: string | null;
    rescuerPhone: string | null;
    address: string | null;
    ngo: string | null;
    broughtBy: string | null;
  };
  /** Called on successful save.  Default: navigate to /patients/{id}. */
  onDone?: () => void;
  /** When provided, renders a Cancel button next to Save. */
  onCancel?: () => void;
}

export function AnimalEditForm({ animal, onDone, onCancel }: Props) {
  const { showToast } = useToast();
  const router = useRouter();
  const [form, setForm] = useState(animal);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onField = <K extends keyof Props['animal']>(key: K, value: Props['animal'][K]) =>
    setForm((s) => ({ ...s, [key]: value }));

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const result = await updateAnimalAction(animal.id, {
        name: form.name,
        breed: form.breed,
        ageText: form.ageText,
        color: form.color,
        weightKg: form.weightKg ? Number(form.weightKg) : null,
        vaccination: form.vaccination as 'DONE' | 'PARTIAL' | 'NONE' | 'NA',
        sterilized: form.sterilized,
        aggressive: form.aggressive,
        contagious: form.contagious,
        ward: form.ward,
        status: form.status as 'CRITICAL' | 'STABLE' | 'OBSERVATION',
        complaint: form.complaint,
        history: form.history,
        injuryType: form.injuryType,
        diagnosis: form.diagnosis,
        immediateTreatment: form.immediateTreatment,
        surgeryRequired: form.surgeryRequired,
        rescuer: form.rescuer,
        rescuerPhone: form.rescuerPhone,
        address: form.address,
        ngo: form.ngo,
        broughtBy: form.broughtBy,
      });
      if (!result.ok) setError(result.error ?? 'Update failed');
      else {
        showToast({ message: 'Patient updated' });
        router.refresh();
        if (onDone) onDone();
        else router.push(`/patients/${animal.id}`);
      }
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <FormSection title="Basics">
        <FormField label="Name">
          {(id) => <Input id={id} value={form.name} onChange={(e) => onField('name', e.target.value)} />}
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Breed">
            {(id) => (
              <Input id={id} value={form.breed ?? ''} onChange={(e) => onField('breed', e.target.value)} />
            )}
          </FormField>
          <FormField label="Approx age">
            {(id) => (
              <Input
                id={id}
                value={form.ageText ?? ''}
                onChange={(e) => onField('ageText', e.target.value)}
              />
            )}
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Weight (kg)">
            {(id) => (
              <Input
                id={id}
                type="text"
                inputMode="decimal"
                pattern="[0-9]*[.,]?[0-9]*"
                value={form.weightKg ?? ''}
                onChange={(e) => onField('weightKg', e.target.value.replace(',', '.'))}
              />
            )}
          </FormField>
          <FormField label="Vaccination">
            {(id) => (
              <Select
                id={id}
                value={form.vaccination}
                onChange={(e) => onField('vaccination', e.target.value)}
              >
                {VACCINATION.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        </div>
        <FormField label="Color / markings">
          {(id) => (
            <Input id={id} value={form.color ?? ''} onChange={(e) => onField('color', e.target.value)} />
          )}
        </FormField>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.sterilized}
              onChange={(e) => onField('sterilized', e.target.checked)}
              className="h-4 w-4 accent-accent"
            />
            Sterilized
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.aggressive}
              onChange={(e) => onField('aggressive', e.target.checked)}
              className="h-4 w-4 accent-accent"
            />
            Aggressive
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.contagious}
              onChange={(e) => onField('contagious', e.target.checked)}
              className="h-4 w-4 accent-accent"
            />
            Contagious
          </label>
        </div>
      </FormSection>

      <FormSection title="Status & ward">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Status">
            {(id) => (
              <Select id={id} value={form.status} onChange={(e) => onField('status', e.target.value)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField label="Ward">
            {(id) => (
              <Input id={id} value={form.ward ?? ''} onChange={(e) => onField('ward', e.target.value)} />
            )}
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Medical">
        <FormField label="Chief complaint">
          {(id) => (
            <Textarea
              id={id}
              rows={2}
              value={form.complaint ?? ''}
              onChange={(e) => onField('complaint', e.target.value)}
            />
          )}
        </FormField>
        <FormField label="History">
          {(id) => (
            <Textarea
              id={id}
              rows={2}
              value={form.history ?? ''}
              onChange={(e) => onField('history', e.target.value)}
            />
          )}
        </FormField>
        <FormField label="Injury type">
          {(id) => (
            <Input
              id={id}
              value={form.injuryType ?? ''}
              onChange={(e) => onField('injuryType', e.target.value)}
            />
          )}
        </FormField>
        <FormField label="Tentative diagnosis">
          {(id) => (
            <Textarea
              id={id}
              rows={2}
              value={form.diagnosis ?? ''}
              onChange={(e) => onField('diagnosis', e.target.value)}
            />
          )}
        </FormField>
        <FormField label="Immediate treatment started">
          {(id) => (
            <Textarea
              id={id}
              rows={2}
              value={form.immediateTreatment ?? ''}
              onChange={(e) => onField('immediateTreatment', e.target.value)}
            />
          )}
        </FormField>
        <FormField label="Surgery required?">
          {(id) => (
            <Input
              id={id}
              value={form.surgeryRequired ?? ''}
              onChange={(e) => onField('surgeryRequired', e.target.value)}
            />
          )}
        </FormField>
      </FormSection>

      <FormSection title="Rescue / Owner">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Rescuer / owner">
            {(id) => (
              <Input
                id={id}
                value={form.rescuer ?? ''}
                onChange={(e) => onField('rescuer', e.target.value)}
              />
            )}
          </FormField>
          <FormField label="Contact">
            {(id) => (
              <Input
                id={id}
                value={form.rescuerPhone ?? ''}
                onChange={(e) => onField('rescuerPhone', e.target.value)}
              />
            )}
          </FormField>
        </div>
        <FormField label="Address">
          {(id) => (
            <Textarea
              id={id}
              rows={2}
              value={form.address ?? ''}
              onChange={(e) => onField('address', e.target.value)}
            />
          )}
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="NGO">
            {(id) => (
              <Input id={id} value={form.ngo ?? ''} onChange={(e) => onField('ngo', e.target.value)} />
            )}
          </FormField>
          <FormField label="Brought by">
            {(id) => (
              <Input
                id={id}
                value={form.broughtBy ?? ''}
                onChange={(e) => onField('broughtBy', e.target.value)}
              />
            )}
          </FormField>
        </div>
      </FormSection>

      {error && (
        <div role="alert" className="text-sm text-critical">
          {error}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel ?? (() => router.back())} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
