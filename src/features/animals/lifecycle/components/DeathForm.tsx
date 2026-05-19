'use client';
import { FormField, FormSection } from '@/components/forms/FormField';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { resumableUpload } from '@/lib/upload/resumable';
import { useState, useTransition } from 'react';
import { deathAction } from '../actions';

interface Props {
  animalId: string;
  onDone: () => void;
}

export function DeathForm({ animalId, onDone }: Props) {
  const [causeOfDeath, setCauseOfDeath] = useState('');
  const [bodyHandedOverTo, setBodyHandedOverTo] = useState('');
  const [postmortemFile, setPostmortemFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      try {
        let postmortemFileId: string | undefined;
        if (postmortemFile) {
          setProgress(0);
          const asset = await resumableUpload({
            file: postmortemFile,
            context: { kind: 'document', animalId, category: 'DEATH' },
            onProgress: (p) => setProgress(p.fraction),
          });
          postmortemFileId = asset.id;
        }
        const result = await deathAction({
          animalId,
          causeOfDeath,
          bodyHandedOverTo,
          postmortemFileId,
        });
        if (!result.ok) setError(result.error ?? 'Failed to record death');
        else onDone();
      } catch (e2) {
        setError(e2 instanceof Error ? e2.message : 'Postmortem upload failed');
      } finally {
        setProgress(null);
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
        <FormField label="Postmortem report (optional)">
          {(id) => (
            <Input
              id={id}
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setPostmortemFile(e.target.files?.[0] ?? null)}
              disabled={pending}
            />
          )}
        </FormField>
      </FormSection>
      {progress !== null && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-paper-2">
          <div
            className="h-full bg-accent transition-all"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}
      {error && <div className="text-sm text-critical">{error}</div>}
      <div className="flex justify-end">
        <Button type="submit" variant="danger" disabled={pending}>
          {pending ? 'Recording…' : 'Record death'}
        </Button>
      </div>
    </form>
  );
}
