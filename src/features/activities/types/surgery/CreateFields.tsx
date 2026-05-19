'use client';
import { FormField } from '@/components/forms/FormField';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import type { CreateFieldsProps } from '../create-shared';

export function SurgeryCreateFields({ form }: CreateFieldsProps) {
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
