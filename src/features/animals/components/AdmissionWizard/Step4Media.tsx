'use client';
import { ImagePlus, X } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { CreateAnimalInput } from '../../schema';

interface Uploaded {
  id: string;
  kind: string;
  filename: string;
}

interface Props {
  form: UseFormReturn<CreateAnimalInput>;
}

export function Step4Media({ form }: Props) {
  const [uploads, setUploads] = useState<Uploaded[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const results: Uploaded[] = [];
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/files/upload', { method: 'POST', body: fd });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? `Upload failed (${res.status})`);
        }
        const json = (await res.json()) as Uploaded;
        results.push(json);
      }
      const newAll = [...uploads, ...results];
      setUploads(newAll);
      form.setValue(
        'mediaAssetIds',
        newAll.map((u) => u.id),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = (id: string) => {
    const newAll = uploads.filter((u) => u.id !== id);
    setUploads(newAll);
    form.setValue(
      'mediaAssetIds',
      newAll.map((u) => u.id),
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="font-display text-base font-semibold">Admission media</h3>
        <p className="mt-1 text-xs text-muted">
          Photos, wound closeups, prior prescriptions, arrival videos. Up to 25MB images / 200MB video.
        </p>
      </div>

      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-line border-dashed bg-paper p-8 text-center text-sm text-muted transition hover:bg-paper-2">
        <ImagePlus size={22} />
        <span>{busy ? 'Uploading…' : 'Click or drop files to upload'}</span>
        <input
          type="file"
          multiple
          accept="image/*,video/*,application/pdf"
          className="hidden"
          disabled={busy}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </label>

      {error && <div className="text-sm text-critical">{error}</div>}

      {uploads.length > 0 && (
        <div className="grid grid-cols-3 gap-3 md:grid-cols-4">
          {uploads.map((u) => (
            <div
              key={u.id}
              className="group relative aspect-square overflow-hidden rounded-md border border-line"
            >
              {u.kind === 'PHOTO' ? (
                <Image
                  src={`/api/files/${u.id}`}
                  alt={u.filename}
                  fill
                  className="object-cover"
                  sizes="200px"
                  unoptimized
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-paper-2 text-xs text-muted">
                  {u.kind}
                </div>
              )}
              <button
                type="button"
                onClick={() => remove(u.id)}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-paper/90 text-muted opacity-0 transition group-hover:opacity-100"
                aria-label={`Remove ${u.filename}`}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
