'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { type CreateAnimalInput, CreateAnimalSchema } from '../../schema';

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
  cageId: '',
  diagnosis: '',
  immediateTreatment: '',
  surgeryRequired: '',
  testsAdvised: [],
  mediaAssetIds: [],
  uploadSessionId: '',
};

export const STEP_LABELS = ['Basics', 'Rescuer', 'Medical', 'Media', 'Doctor notes'];

export function useAdmissionForm() {
  // Wire the same CreateAnimalSchema the server uses, so step.trigger()
  // actually fires the Zod gate.  Without the resolver, RHF only ran
  // its own (empty) rule set and let users Continue past required
  // fields — the server still rejected the final submit but the UX
  // was broken (the user got a banner error after 5 wasted clicks).
  const form = useForm<CreateAnimalInput>({
    defaultValues: DEFAULTS,
    mode: 'onBlur',
    // biome-ignore lint/suspicious/noExplicitAny: zodResolver/RHF type drift across versions
    resolver: zodResolver(CreateAnimalSchema) as any,
  });
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
