'use client';
import { MediaUploader, type UploadedAsset } from '@/components/media/MediaUploader';
import { newUploadSessionId } from '@/lib/upload/resumable';
import { useEffect, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { CreateAnimalInput } from '../../schema';

interface Props {
  form: UseFormReturn<CreateAnimalInput>;
}

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

  const [assets, setAssets] = useState<UploadedAsset[]>([]);

  const handleChange = (next: UploadedAsset[]) => {
    setAssets(next);
    form.setValue(
      'mediaAssetIds',
      next.map((a) => a.id),
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="font-display font-semibold text-base">Admission media</h3>
        <p className="mt-1 text-muted text-xs">
          Photos, wound closeups, prior prescriptions, arrival videos. Up to 50&nbsp;MB images / 2&nbsp;GB
          video.
        </p>
      </div>

      <MediaUploader value={assets} onChange={handleChange} context={{ kind: 'staging', sessionId }} />
    </div>
  );
}
