'use client';
import { type FinalizeResponse, type UploadContext, resumableUpload } from '@/lib/upload/resumable';
import { FileText, ImagePlus, Loader2, Video, X } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';

export interface UploadedAsset {
  id: string;
  kind: FinalizeResponse['kind'];
  filename: string;
  /** Pre-signed URL for the asset, ready to use in <img src>. */
  url: string;
}

interface InFlight {
  id: string;
  filename: string;
  fraction: number;
}

interface Props {
  value: UploadedAsset[];
  onChange: (next: UploadedAsset[]) => void;
  context: UploadContext;
  label?: string;
  description?: string;
  accept?: string;
  /** When true, hides the dashed dropzone (e.g. when used inline). */
  compact?: boolean;
}

export function MediaUploader({
  value,
  onChange,
  context,
  label,
  description,
  accept = 'image/*,video/*,application/pdf',
  compact = false,
}: Props) {
  const [inFlight, setInFlight] = useState<InFlight[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    const arr = Array.from(files);

    // Accumulate completed assets locally so each iteration sees the latest
    // running set rather than the stale `value` prop the closure captured.
    // The old code did `onChange([...value, ...])` per file, but `value` was
    // the prop snapshot when handleFiles was invoked — so dropping two files
    // at once silently lost the first one.
    let running = value.slice();
    for (const file of arr) {
      const tempId = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setInFlight((cur) => [...cur, { id: tempId, filename: file.name, fraction: 0 }]);
      try {
        const result = await resumableUpload({
          file,
          context,
          onProgress: (p) => {
            setInFlight((cur) => cur.map((u) => (u.id === tempId ? { ...u, fraction: p.fraction } : u)));
          },
        });
        running = [
          ...running,
          { id: result.id, kind: result.kind, filename: result.filename, url: result.url },
        ];
        onChange(running);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed');
      } finally {
        setInFlight((cur) => cur.filter((u) => u.id !== tempId));
      }
    }
  };

  const remove = (id: string) => onChange(value.filter((u) => u.id !== id));

  const busy = inFlight.length > 0;
  const hasAny = inFlight.length > 0 || value.length > 0;

  return (
    <div className="flex flex-col gap-2.5">
      {label && (
        <div className="flex items-baseline justify-between">
          <span className="font-bold text-[10.5px] text-muted uppercase tracking-[0.06em]">
            {label}
            {value.length > 0 && ` · ${value.length}`}
          </span>
          {description && <span className="text-[11px] text-soft">{description}</span>}
        </div>
      )}

      {!compact && (
        <label
          className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-line border-dashed bg-paper p-6 text-center text-[12.5px] text-muted transition ${
            busy ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-paper-2'
          }`}
        >
          <ImagePlus size={20} />
          <span>{busy ? `Uploading ${inFlight.length}…` : 'Click or drop files to upload'}</span>
          <input
            type="file"
            multiple
            accept={accept}
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
      )}

      {error && <div className="text-[12.5px] text-critical">{error}</div>}

      {hasAny && (
        <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
          {inFlight.map((u) => (
            <div
              key={u.id}
              className="relative aspect-square overflow-hidden rounded-lg border border-line bg-paper-2"
            >
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-[10px] text-muted">
                <Loader2 size={18} className="animate-spin" />
                <span className="px-2 text-center">{u.filename}</span>
              </div>
              <div
                className="absolute right-0 bottom-0 left-0 h-1 bg-accent transition-all"
                style={{ width: `${Math.round(u.fraction * 100)}%` }}
              />
            </div>
          ))}
          {value.map((u) => (
            <div
              key={u.id}
              className="group relative aspect-square overflow-hidden rounded-lg border border-line"
            >
              {u.kind === 'PHOTO' || u.kind === 'XRAY' ? (
                <Image src={u.url} alt={u.filename} fill className="object-cover" sizes="200px" />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-paper-2 px-2 text-center text-[10px] text-muted">
                  {u.kind === 'VIDEO' ? <Video size={18} /> : <FileText size={18} />}
                  <span className="font-semibold">{u.kind}</span>
                  <span className="truncate">{u.filename}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => remove(u.id)}
                className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-paper/90 text-muted opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
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
