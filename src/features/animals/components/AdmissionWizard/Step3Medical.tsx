'use client';
import { FormField, FormSection } from '@/components/forms/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import type { UseFormReturn } from 'react-hook-form';
import { type CreateAnimalInput, STATUSES } from '../../schema';

interface Props {
  form: UseFormReturn<CreateAnimalInput>;
}

export function Step3Medical({ form }: Props) {
  const { register } = form;
  return (
    <FormSection title="Medical condition" description="Why is this animal in IPD?">
      <FormField label="Chief complaint" htmlFor="complaint">
        <Textarea id="complaint" rows={3} {...register('complaint')} />
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Injury type" htmlFor="injuryType" hint="Trauma, medical, post-op, etc.">
          <Input id="injuryType" {...register('injuryType')} />
        </FormField>
        <FormField label="Ward" htmlFor="ward">
          <Input id="ward" placeholder="ICU-1, Cat ward…" {...register('ward')} />
        </FormField>
      </div>
      <FormField label="History" htmlFor="history">
        <Textarea id="history" rows={3} {...register('history')} />
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Status" htmlFor="status">
          <Select id="status" {...register('status')}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
        </FormField>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input type="checkbox" {...register('contagious')} className="h-4 w-4 accent-accent" />
          Contagious
        </label>
      </div>
    </FormSection>
  );
}
