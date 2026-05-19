'use client';
import { FormField, FormSection } from '@/components/forms/FormField';
import { MediaUploader, type UploadedAsset } from '@/components/media/MediaUploader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { AlertTriangle } from 'lucide-react';
import { useState, useTransition } from 'react';
import { deathAction } from '../actions';

interface Props {
  animalId: string;
  onDone: () => void;
}

export function DeathForm({ animalId, onDone }: Props) {
  const { showToast } = useToast();
  const [causeOfDeath, setCauseOfDeath] = useState('');
  const [bodyHandedOverTo, setBodyHandedOverTo] = useState('');
  const [docs, setDocs] = useState<UploadedAsset[]>([]);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const result = await deathAction({
        animalId,
        causeOfDeath,
        bodyHandedOverTo,
        documentFileIds: docs.map((d) => d.id),
      });
      if (!result.ok) setError(result.error ?? 'Failed to record death');
      else {
        showToast({ message: 'Death recorded' });
        onDone();
      }
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <FormSection title="Record death" description="Capture cause and handover details">
        <FormField label="Cause of death" required>
          {(id) => (
            <Textarea
              id={id}
              rows={3}
              value={causeOfDeath}
              onChange={(e) => setCauseOfDeath(e.target.value)}
            />
          )}
        </FormField>
        <FormField label="Body handed over to">
          {(id) => (
            <Input
              id={id}
              value={bodyHandedOverTo}
              onChange={(e) => setBodyHandedOverTo(e.target.value)}
              placeholder="Rescuer name, NGO, owner…"
            />
          )}
        </FormField>
        <MediaUploader
          value={docs}
          onChange={setDocs}
          context={{ kind: 'document', animalId, category: 'DEATH' }}
          label="Death certificate · postmortem · body handover"
          accept="image/*,application/pdf"
        />
      </FormSection>

      <div className="flex items-start gap-2.5 rounded-xl border border-critical/30 bg-critical-bg/60 p-3.5">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-critical" />
        <p className="text-[12.5px] text-critical leading-relaxed">
          This will mark the animal as deceased and remove it from active IPD. Records are kept permanently.
        </p>
      </div>

      {error && (
        <div role="alert" className="text-critical text-sm">
          {error}
        </div>
      )}
      <div className="flex justify-end">
        <Button type="submit" variant="danger" disabled={pending}>
          {pending ? 'Recording…' : 'Record death'}
        </Button>
      </div>
    </form>
  );
}
