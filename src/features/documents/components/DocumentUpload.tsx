'use client';
import { FormField } from '@/components/forms/FormField';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Upload } from 'lucide-react';
import { useState, useTransition } from 'react';
import { createDocumentAction } from '../actions';
import { DOC_CATEGORIES, DOC_CATEGORY_LABELS, DOC_KIND_SUGGESTIONS, type DocCategory } from '../schema';

interface Props {
  animalId: string;
  onDone: () => void;
}

export function DocumentUpload({ animalId, onDone }: Props) {
  const [category, setCategory] = useState<DocCategory>('MEDICAL');
  const [kind, setKind] = useState('');
  const [file, setFile] = useState<File | null>(null);
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
      const fd = new FormData();
      fd.append('file', file);
      const upRes = await fetch('/api/files/upload', { method: 'POST', body: fd });
      if (!upRes.ok) {
        const j = (await upRes.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? 'Upload failed');
        return;
      }
      const asset = (await upRes.json()) as { id: string };
      const result = await createDocumentAction({
        animalId,
        category,
        kind: kind || category,
        name: file.name,
        fileId: asset.id,
      });
      if (!result.ok) setError(result.error ?? 'Save failed');
      else onDone();
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
          />
        )}
      </FormField>
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
