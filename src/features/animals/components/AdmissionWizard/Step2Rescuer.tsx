'use client';
import { FormField, FormSection } from '@/components/forms/FormField';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import type { UseFormReturn } from 'react-hook-form';
import type { CreateAnimalInput } from '../../schema';

interface Props {
  form: UseFormReturn<CreateAnimalInput>;
}

export function Step2Rescuer({ form }: Props) {
  const { register } = form;
  return (
    <FormSection title="Rescue / Owner" description="Who brought the animal and contact details">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Rescuer / Owner name" htmlFor="rescuer">
          <Input id="rescuer" {...register('rescuer')} />
        </FormField>
        <FormField label="Contact number" htmlFor="rescuerPhone">
          <Input id="rescuerPhone" type="tel" {...register('rescuerPhone')} />
        </FormField>
      </div>
      <FormField label="Address" htmlFor="address">
        <Textarea id="address" rows={2} {...register('address')} />
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="NGO / Ambulance" htmlFor="ngo">
          <Input id="ngo" {...register('ngo')} />
        </FormField>
        <FormField label="Brought by staff" htmlFor="broughtBy">
          <Input id="broughtBy" {...register('broughtBy')} />
        </FormField>
      </div>
    </FormSection>
  );
}
