'use client';
import { FormField, FormSection } from '@/components/forms/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { UseFormReturn } from 'react-hook-form';
import { type CreateAnimalInput, GENDER, SPECIES, VACCINATION } from '../../schema';

interface Props {
  form: UseFormReturn<CreateAnimalInput>;
}

export function Step1Basics({ form }: Props) {
  const { register, formState } = form;
  return (
    <FormSection title="Basics" description="Identification + intake info">
      <FormField
        label="Animal name / temporary ID"
        htmlFor="name"
        required
        error={formState.errors.name?.message}
      >
        <Input id="name" {...register('name')} invalid={!!formState.errors.name} />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Species" htmlFor="species" required>
          <Select id="species" {...register('species')}>
            {SPECIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Breed" htmlFor="breed">
          <Input id="breed" {...register('breed')} />
        </FormField>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <FormField label="Gender" htmlFor="gender">
          <Select id="gender" {...register('gender')}>
            <option value="">—</option>
            {GENDER.map((g) => (
              <option key={g} value={g}>
                {g.charAt(0) + g.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Approx age" htmlFor="ageText" hint="e.g. ~2 yrs">
          <Input id="ageText" {...register('ageText')} />
        </FormField>
        <FormField label="Weight (kg)" htmlFor="weightKg">
          <Input
            id="weightKg"
            type="text"
            inputMode="decimal"
            pattern="[0-9]*[.,]?[0-9]*"
            {...register('weightKg' as const, {
              setValueAs: (v) => (typeof v === 'string' ? v.replace(',', '.') : v),
            })}
          />
        </FormField>
      </div>

      <FormField label="Color / Identification" htmlFor="color">
        <Input id="color" {...register('color')} placeholder="Brown & white, scar on nose" />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Vaccination" htmlFor="vaccination">
          <Select id="vaccination" {...register('vaccination')}>
            {VACCINATION.map((v) => (
              <option key={v} value={v}>
                {v.charAt(0) + v.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
        </FormField>
        <div className="flex items-end gap-6 pb-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register('sterilized')} className="h-4 w-4 accent-accent" />
            Sterilized
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register('aggressive')} className="h-4 w-4 accent-accent" />
            Aggressive
          </label>
        </div>
      </div>
    </FormSection>
  );
}
