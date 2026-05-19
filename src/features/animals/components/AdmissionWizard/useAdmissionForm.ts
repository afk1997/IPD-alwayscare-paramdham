'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { CreateAnimalInput } from '../../schema';

const DEFAULTS: CreateAnimalInput = {
  name: '',
  species: 'Dog',
  breed: '',
  gender: undefined,
  ageText: '',
  color: '',
  weightKg: undefined,
  vaccination: 'NONE',
  sterilized: false,
  aggressive: false,
  rescuer: '',
  rescuerPhone: '',
  address: '',
  ngo: '',
  broughtBy: '',
  complaint: '',
  injuryType: '',
  history: '',
  contagious: false,
  status: 'OBSERVATION',
  ward: '',
  diagnosis: '',
  surgeryRequired: '',
  testsAdvised: [],
  mediaAssetIds: [],
  uploadSessionId: '',
};

export const STEP_LABELS = ['Basics', 'Rescuer', 'Medical', 'Media', 'Doctor notes'];

export function useAdmissionForm() {
  const form = useForm<CreateAnimalInput>({ defaultValues: DEFAULTS, mode: 'onBlur' });
  const [step, setStep] = useState(0);

  const next = async (fieldsToValidate?: (keyof CreateAnimalInput)[]) => {
    if (fieldsToValidate) {
      const valid = await form.trigger(fieldsToValidate);
      if (!valid) return false;
    }
    setStep((s) => Math.min(s + 1, STEP_LABELS.length - 1));
    return true;
  };

  const prev = () => setStep((s) => Math.max(s - 1, 0));

  return { form, step, next, prev, totalSteps: STEP_LABELS.length };
}
