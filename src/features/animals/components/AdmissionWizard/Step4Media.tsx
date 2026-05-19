'use client';
import { type FinalizeResponse, newUploadSessionId, resumableUpload } from '@/lib/upload/resumable';
import { ImagePlus, Loader2, Video, X } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { CreateAnimalInput } from '../../schema';

interface Uploaded {
  id: string;
  kind: FinalizeResponse['kind'];
  filename: string;
}

interface InFlight {
  id: string;
  filename: string;
  fraction: number;
}

interface Props {
  form: UseFormReturn<CreateAnimalInput>;
}

export function Step4Media({ form }: Props) {
  // Lazy state init keeps the random id stable across re-renders. The
  // useEffect mirrors it into RHF so the wizard submit sees it. No setValue
  // during render.
  const [sessionId] = useState(() => form.getValues('uploadSessionId') || newUploadSessionId());
  useEffect(() => {
    if (form.getValues('uploadSessionId') !== sessionId) {
      form.setValue('uploadSessionId', sessionId);
    }
  }, [form, sessionId]);

  const [uploads, setUploads] = useState<Uploaded[]>([]);
  const [inFlight, setInFlight] = useState<InFlight[]>([]);
  const [error, setError] = useState<string | null>(null);

  const setMediaIds = (next: Uploaded[]) => {
    form.setValue(
      'mediaAssetIds',
      next.map((u) => u.id),
    );
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    const arr = Array.from(files);

    for (const file of arr) {
      const tempId = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setInFlight((cur) => [...cur, { id: tempId, filename: file.name, fraction: 0 }]);
      try {
        const result = await resumableUpload({
          file,
          context: { kind: 'staging', sessionId },
          onProgress: (p) => {
            setInFlight((cur) => cur.map((u) => (u.id === tempId ? { ...u, fraction: p.fraction } : u)));
          },
        });
        setUploads((cur) => {
          const next = [...cur, { id: result.id, kind: result.kind, filename: result.filename }];
          setMediaIds(next);
          return next;
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed');
      } finally {
        setInFlight((cur) => cur.filter((u) => u.id !== tempId));
      }
    }
  };

  const remove = (id: string) => {
    setUploads((cur) => {
      const next = cur.filter((u) => u.id !== id);
      setMediaIds(next);
      return next;
    });
  };

  const busy = inFlight.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="font-display text-base font-semibold">Admission media</h3>
        <p className="mt-1 text-xs text-muted">
          Photos, wound closeups, prior prescriptions, arrival videos. Up to 50&nbsp;MB images / 2&nbsp;GB
          video.
        </p>
      </div>

      <label
        className={`flex flex-col items-center justify-center gap-2 rounded-lg border border-line border-dashed bg-paper p-8 text-center text-sm text-muted transition ${
          busy ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-paper-2'
        }`}
      >
        <ImagePlus size={22} />
        <span>{busy ? `Uploading ${inFlight.length}…` : 'Click or drop files to upload'}</span>
        <input
          type="file"
          multiple
          accept="image/*,video/*,application/pdf"
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            handleFiles(e.target.files);
            // Reset so picking the same file again still triggers a change.
            e.target.value = '';
          }}
        />
      </label>

      {error && <div className="text-sm text-critical">{error}</div>}

      {(inFlight.length > 0 || uploads.length > 0) && (
        <div className="grid grid-cols-3 gap-3 md:grid-cols-4">
          {inFlight.map((u) => (
            <div
              key={u.id}
              className="relative aspect-square overflow-hidden rounded-md border border-line bg-paper-2"
            >
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs text-muted">
                <Loader2 size={20} className="animate-spin" />
                <span className="px-2 text-center text-[10px]">{u.filename}</span>
              </div>
              <div
                className="absolute right-0 bottom-0 left-0 h-1 bg-accent transition-all"
                style={{ width: `${Math.round(u.fraction * 100)}%` }}
              />
            </div>
          ))}
          {uploads.map((u) => (
            <div
              key={u.id}
              className="group relative aspect-square overflow-hidden rounded-md border border-line"
            >
              {u.kind === 'PHOTO' || u.kind === 'XRAY' ? (
                <Image
                  src={`/api/files/${u.id}`}
                  alt={u.filename}
                  fill
                  className="object-cover"
                  sizes="200px"
                  unoptimized
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-paper-2 px-2 text-center text-xs text-muted">
                  {u.kind === 'VIDEO' && <Video size={20} />}
                  <span className="font-semibold">{u.kind}</span>
                  <span className="truncate text-[10px]">{u.filename}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => remove(u.id)}
                className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-paper/90 text-muted opacity-0 transition group-hover:opacity-100"
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
