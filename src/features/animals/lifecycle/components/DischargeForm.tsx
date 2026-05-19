'use client';
import { FormField, FormSection } from '@/components/forms/FormField';
import { MediaUploader, type UploadedAsset } from '@/components/media/MediaUploader';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { useState, useTransition } from 'react';
import { dischargeAction } from '../actions';

interface Props {
  animalId: string;
  onDone: () => void;
}

export function DischargeForm({ animalId, onDone }: Props) {
  const [summary, setSummary] = useState('');
  const [instructions, setInstructions] = useState('');
  const [docs, setDocs] = useState<UploadedAsset[]>([]);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const result = await dischargeAction({
        animalId,
        summary,
        instructions,
        documentFileIds: docs.map((d) => d.id),
      });
      if (!result.ok) setError(result.error ?? 'Failed to discharge');
      else onDone();
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <FormSection title="Discharge animal" description="Mark this patient as discharged">
        <FormField label="Summary" required>
          {(id) => (
            <Textarea
              id={id}
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Recovered, treatment outcome…"
            />
          )}
        </FormField>
        <FormField label="Post-discharge instructions">
          {(id) => (
            <Textarea
              id={id}
              rows={3}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          )}
        </FormField>
        <MediaUploader
          value={docs}
          onChange={setDocs}
          context={{ kind: 'document', animalId, category: 'CONSENT' }}
          label="Discharge summary / consent"
          accept="image/*,application/pdf"
        />
      </FormSection>
      {error && <div className="text-sm text-critical">{error}</div>}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? 'Discharging…' : 'Discharge animal'}
        </Button>
      </div>
    </form>
  );
}
