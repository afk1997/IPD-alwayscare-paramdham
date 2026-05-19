'use client';
import { FormField } from '@/components/forms/FormField';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { resumableUpload } from '@/lib/upload/resumable';
import { Upload } from 'lucide-react';
import { useState, useTransition } from 'react';
import { createDocumentAction } from '../actions';
import { DOC_CATEGORIES, DOC_CATEGORY_LABELS, DOC_KIND_SUGGESTIONS, type DocCategory } from '../schema';

interface Props {
  animalId: string;
  onDone: () => void;
}

export function DocumentUpload({ animalId, onDone }: Props) {
  const { showToast } = useToast();
  const [category, setCategory] = useState<DocCategory>('MEDICAL');
  const [kind, setKind] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file) {
      setError('Pick a file first');
      return;
    }
    setError(null);
    start(async () => {
      try {
        setProgress(0);
        const asset = await resumableUpload({
          file,
          context: { kind: 'document', animalId, category },
          onProgress: (p) => setProgress(p.fraction),
        });
        const result = await createDocumentAction({
          animalId,
          category,
          kind: kind || category,
          name: file.name,
          fileId: asset.id,
        });
        if (!result.ok) {
          setError(result.error ?? 'Save failed');
        } else {
          showToast({ message: 'Document uploaded' });
          onDone();
        }
      } catch (e2) {
        setError(e2 instanceof Error ? e2.message : 'Upload failed');
      } finally {
        setProgress(null);
      }
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <FormField label="Category" required>
        {(id) => (
          <Select id={id} value={category} onChange={(e) => setCategory(e.target.value as DocCategory)}>
            {DOC_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {DOC_CATEGORY_LABELS[c]}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      <FormField label="Kind" hint="Free text or pick a suggestion below" required>
        {(id) => (
          <Input
            id={id}
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            placeholder={DOC_KIND_SUGGESTIONS[category][0] ?? ''}
          />
        )}
      </FormField>
      <div className="flex flex-wrap gap-1.5">
        {DOC_KIND_SUGGESTIONS[category].map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className="rounded-full border border-line bg-paper px-2.5 py-1 text-xs text-muted hover:bg-paper-2"
          >
            {k}
          </button>
        ))}
      </div>
      <FormField label="File" required>
        {(id) => (
          <Input
            id={id}
            type="file"
            accept="image/*,video/*,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={pending}
          />
        )}
      </FormField>
      {progress !== null && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-paper-2">
          <div
            className="h-full bg-accent transition-all"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}
      {error && <div className="text-sm text-critical">{error}</div>}
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          <Upload size={14} />
          {pending ? 'Uploading…' : 'Upload'}
        </Button>
      </div>
    </form>
  );
}
