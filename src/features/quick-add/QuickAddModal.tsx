'use client';
import { ActivityForm } from '@/features/activities/components/ActivityForm';
import type { ActivityType } from '@/features/activities/schema';
import { LifecycleForm } from '@/features/animals/lifecycle/components/LifecycleForm';
import type { ActiveAnimalLite } from '@/features/animals/queries';
import { DocumentUpload } from '@/features/documents/components/DocumentUpload';
import { useSwipeDown } from '@/lib/hooks/useSwipeDown';
import { ArrowLeft, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ActivityTypeChooser } from './ActivityTypeChooser';
import { PatientPicker } from './PatientPicker';
import { QuickAddMenu } from './QuickAddMenu';
import type { QuickAddAction, QuickAddStep } from './types';

interface Prefill {
  action: 'admission' | 'activity' | 'document' | 'lifecycle';
  activityType?: ActivityType;
}

interface Props {
  open: boolean;
  onClose: () => void;
  prefill?: Prefill | null;
}

const INITIAL: QuickAddStep = { kind: 'menu' };

export function QuickAddModal({ open, onClose, prefill }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<QuickAddStep>(INITIAL);

  // When the modal opens, apply any prefill from `useQuickAdd().open(...)`
  // by jumping straight to the patient picker (or, for admission, closing
  // the modal and navigating to /patients/new).  When it closes we reset
  // to the menu step for the next open.
  useEffect(() => {
    if (!open) {
      setStep(INITIAL);
      return;
    }
    if (!prefill) {
      setStep(INITIAL);
      return;
    }
    if (prefill.action === 'admission') {
      onClose();
      router.push('/patients/new');
      return;
    }
    setStep({ kind: 'pick-patient', purpose: prefill.action });
  }, [open, prefill, onClose, router]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Must stay above the early-return below — hooks have to run in the same
  // order every render or React throws ("rendered fewer hooks than expected").
  const swipe = useSwipeDown({ onClose });

  if (!open) return null;

  const handleAction = (action: QuickAddAction) => {
    if (action === 'admission') {
      onClose();
      router.push('/patients/new');
      return;
    }
    setStep({ kind: 'pick-patient', purpose: action });
  };

  const handlePatient = (animal: ActiveAnimalLite) => {
    if (step.kind !== 'pick-patient') return;
    if (step.purpose === 'activity') {
      // If a prefill provided the activity type (e.g. "Log treatment"
      // quick-action), skip the type chooser and go straight to the form.
      if (prefill?.activityType) {
        setStep({
          kind: 'activity-form',
          animalId: animal.id,
          animalName: animal.name,
          type: prefill.activityType,
        });
      } else {
        setStep({ kind: 'activity-type', animalId: animal.id, animalName: animal.name });
      }
    } else if (step.purpose === 'document') {
      setStep({ kind: 'document-form', animalId: animal.id, animalName: animal.name });
    } else {
      setStep({ kind: 'lifecycle-form', animalId: animal.id, animalName: animal.name });
    }
  };

  const handleType = (type: ActivityType) => {
    if (step.kind !== 'activity-type') return;
    setStep({ kind: 'activity-form', animalId: step.animalId, animalName: step.animalName, type });
  };

  const goBack = () => {
    if (step.kind === 'menu') return onClose();
    if (step.kind === 'pick-patient') return setStep({ kind: 'menu' });
    if (step.kind === 'activity-type') return setStep({ kind: 'pick-patient', purpose: 'activity' });
    if (step.kind === 'activity-form')
      return setStep({ kind: 'activity-type', animalId: step.animalId, animalName: step.animalName });
    if (step.kind === 'document-form') return setStep({ kind: 'pick-patient', purpose: 'document' });
    if (step.kind === 'lifecycle-form') return setStep({ kind: 'pick-patient', purpose: 'lifecycle' });
  };

  const finish = (animalId: string) => {
    onClose();
    router.push(`/patients/${animalId}`);
    router.refresh();
  };

  const title = headerTitle(step);
  const showBack = step.kind !== 'menu';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/45 backdrop-blur-[1px]"
      />
      <div
        className="relative flex max-h-[88vh] w-full max-w-[460px] flex-col rounded-t-[22px] bg-paper p-5 shadow-2xl md:rounded-2xl"
        // biome-ignore lint/a11y/useSemanticElements: native <dialog> requires showModal()
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={swipe.style}
      >
        <div className="mb-3 hidden md:block" />
        {/* Drag handle — also the swipe target on mobile.  Putting touch
            listeners on the whole sheet would steal scrolls inside the
            content, so we scope them to this grabber strip. */}
        <div className="-mx-5 -mt-5 mb-2 flex justify-center px-5 py-2 md:hidden" {...swipe.bind}>
          <div className="h-1 w-9 rounded-full bg-line" />
        </div>
        <div className="mb-4 flex items-center gap-2">
          {showBack && (
            <button
              type="button"
              onClick={goBack}
              aria-label="Back"
              className="-ml-2 flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-paper-2"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <h2 className="flex-1 font-display font-bold text-[17px] text-text">{title}</h2>
          <kbd className="hidden rounded border border-line bg-paper-2 px-1.5 py-0.5 font-mono text-[10px] text-soft md:inline">
            esc
          </kbd>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-paper-2"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {step.kind === 'menu' && <QuickAddMenu onPick={handleAction} />}
          {step.kind === 'pick-patient' && <PatientPicker onPick={handlePatient} onCancel={onClose} />}
          {step.kind === 'activity-type' && (
            <div className="flex flex-col gap-3">
              <p className="text-[12.5px] text-muted">
                Patient: <span className="font-semibold text-text">{step.animalName}</span>
              </p>
              <ActivityTypeChooser onPick={handleType} />
            </div>
          )}
          {step.kind === 'activity-form' && (
            <ActivityForm animalId={step.animalId} type={step.type} onDone={() => finish(step.animalId)} />
          )}
          {step.kind === 'document-form' && (
            <DocumentUpload animalId={step.animalId} onDone={() => finish(step.animalId)} />
          )}
          {step.kind === 'lifecycle-form' && (
            <LifecycleForm animalId={step.animalId} onDone={() => finish(step.animalId)} />
          )}
        </div>
      </div>
    </div>
  );
}

function headerTitle(step: QuickAddStep): string {
  switch (step.kind) {
    case 'menu':
      return 'New entry';
    case 'pick-patient':
      return step.purpose === 'activity'
        ? 'Pick patient — log activity'
        : step.purpose === 'document'
          ? 'Pick patient — upload document'
          : 'Pick patient — end of stay';
    case 'activity-type':
      return 'Log activity';
    case 'activity-form':
      return `Log activity — ${step.animalName}`;
    case 'document-form':
      return `Upload document — ${step.animalName}`;
    case 'lifecycle-form':
      return `End of stay — ${step.animalName}`;
  }
}
