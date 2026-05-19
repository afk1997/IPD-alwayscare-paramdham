'use client';
import { MediaUploader, type UploadedAsset } from '@/components/media/MediaUploader';
import { newUploadSessionId } from '@/lib/upload/resumable';
import { useEffect, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { CreateAnimalInput } from '../../schema';

interface Props {
  form: UseFormReturn<CreateAnimalInput>;
}

// Per-bucket uploaders match the mockup's four labelled sections.  All
// assets end up in the same staging folder on Drive (same session id) so
// admit-time `movePending()` picks them up uniformly; the bucketing is a
// UX hint, not a storage distinction.
interface BucketDef {
  key: 'photos' | 'videos' | 'wounds' | 'prescriptions';
  label: string;
  accept: string;
}

const BUCKETS: BucketDef[] = [
  { key: 'photos', label: 'Admission photos', accept: 'image/*' },
  { key: 'videos', label: 'Admission videos', accept: 'video/*' },
  { key: 'wounds', label: 'Wound closeups', accept: 'image/*' },
  { key: 'prescriptions', label: 'Previous prescriptions', accept: 'image/*,application/pdf' },
];

type BucketState = Record<BucketDef['key'], UploadedAsset[]>;

export function Step4Media({ form }: Props) {
  // Lazy state init keeps the random id stable across re-renders.  The
  // useEffect mirrors it into RHF so the wizard submit sees it — no
  // setValue during render.
  const [sessionId] = useState(() => form.getValues('uploadSessionId') || newUploadSessionId());
  useEffect(() => {
    if (form.getValues('uploadSessionId') !== sessionId) {
      form.setValue('uploadSessionId', sessionId);
    }
  }, [form, sessionId]);

  const [buckets, setBuckets] = useState<BucketState>({
    photos: [],
    videos: [],
    wounds: [],
    prescriptions: [],
  });

  const handleBucketChange = (key: BucketDef['key']) => (next: UploadedAsset[]) => {
    // Functional setState — the previous closure-based merge captured
    // `buckets` at render time, so two concurrent uploads in different
    // buckets would each compute `merged` from the same stale snapshot
    // and clobber each other.  Reproducible by dropping a photo into
    // "Admission photos" and a video into "Admission videos" at the
    // same instant: only one survived.  Fix: derive merged inside the
    // setter, then mirror into RHF using the same fresh value.
    setBuckets((prev) => {
      const merged: BucketState = { ...prev, [key]: next };
      const allIds = ([] as string[]).concat(...BUCKETS.map((b) => merged[b.key].map((a) => a.id)));
      form.setValue('mediaAssetIds', allIds);
      return merged;
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="font-display font-semibold text-base">Admission media</h3>
        <p className="mt-1 text-muted text-xs">
          Photos, wound closeups, prior prescriptions, arrival videos. Up to 50&nbsp;MB images / 2&nbsp;GB
          video.
        </p>
      </div>

      {BUCKETS.map((b) => (
        <MediaUploader
          key={b.key}
          value={buckets[b.key]}
          onChange={handleBucketChange(b.key)}
          context={{ kind: 'staging', sessionId }}
          label={b.label}
          accept={b.accept}
        />
      ))}
    </div>
  );
}
