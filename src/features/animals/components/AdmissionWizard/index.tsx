'use client';
import { Button } from '@/components/ui/Button';
import { Stepper } from '@/components/ui/Stepper';
import { useState, useTransition } from 'react';
import { createAnimalAction } from '../../actions';
import type { CreateAnimalInput } from '../../schema';
import { Step1Basics } from './Step1Basics';
import { Step2Rescuer } from './Step2Rescuer';
import { Step3Medical } from './Step3Medical';
import { Step4Media } from './Step4Media';
import { Step5DoctorNotes } from './Step5DoctorNotes';
import { STEP_LABELS, useAdmissionForm } from './useAdmissionForm';

const STEP_VALIDATION: Record<number, (keyof CreateAnimalInput)[]> = {
  0: ['name', 'species'],
  1: [],
  2: ['status'],
  3: [],
  4: [],
};

export function AdmissionWizard() {
  const { form, step, next, prev } = useAdmissionForm();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onNext = async () => {
    const fields = STEP_VALIDATION[step] ?? [];
    await next(fields);
  };

  const onSubmit = () => {
    setError(null);
    start(async () => {
      const values = form.getValues();
      const result = await createAnimalAction(values);
      if (!result.ok) setError(result.error ?? 'Failed to admit');
    });
  };

  const isLast = step === STEP_LABELS.length - 1;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">New admission</h1>
        <p className="mt-1 text-sm text-muted">
          Step {step + 1} of {STEP_LABELS.length}
        </p>
      </div>

      <Stepper steps={STEP_LABELS} current={step} />

      <div className="rounded-lg border border-line bg-paper p-6">
        {step === 0 && <Step1Basics form={form} />}
        {step === 1 && <Step2Rescuer form={form} />}
        {step === 2 && <Step3Medical form={form} />}
        {step === 3 && <Step4Media form={form} />}
        {step === 4 && <Step5DoctorNotes form={form} />}
      </div>

      {error && <div className="text-sm text-critical">{error}</div>}

      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" onClick={prev} disabled={step === 0 || pending}>
          Back
        </Button>
        {isLast ? (
          <Button type="button" onClick={onSubmit} disabled={pending}>
            {pending ? 'Admitting…' : 'Admit animal'}
          </Button>
        ) : (
          <Button type="button" onClick={onNext}>
            Continue
          </Button>
        )}
      </div>
    </div>
  );
}
