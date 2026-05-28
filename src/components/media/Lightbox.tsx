'use client';
import { useSwipeHorizontal } from '@/lib/hooks/useSwipeHorizontal';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import Image from 'next/image';
import { useEffect } from 'react';

export interface LightboxItem {
  id: string;
  filename: string;
  kind: 'PHOTO' | 'VIDEO' | 'XRAY' | 'DOC';
  label?: string | null;
  /** Pre-signed URL for the asset, ready to use in <img src>. */
  url: string;
}

interface Props {
  items: LightboxItem[];
  index: number | null;
  onClose: () => void;
  onChange: (next: number) => void;
}

export function Lightbox({ items, index, onClose, onChange }: Props) {
  useEffect(() => {
    if (index === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && index !== null && index > 0) onChange(index - 1);
      if (e.key === 'ArrowRight' && index !== null && index < items.length - 1) onChange(index + 1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, items.length, onClose, onChange]);

  // UI-3: wire mobile swipe gestures. Hook is always invoked (rules of
  // hooks); the early return below stops the render when closed.
  const hasPrev = index !== null && index > 0;
  const hasNext = index !== null && index < items.length - 1;
  const swipe = useSwipeHorizontal({
    threshold: 60,
    onSwipeLeft: () => {
      if (hasNext) onChange((index as number) + 1);
    },
    onSwipeRight: () => {
      if (hasPrev) onChange((index as number) - 1);
    },
  });

  if (index === null) return null;
  const current = items[index];
  if (!current) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" {...swipe.bind}>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/90"
      />
      <div className="relative z-10 flex h-full max-h-[92vh] w-full max-w-[1100px] flex-col items-center justify-center p-4 pt-12">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-translate-x-1/2 absolute top-3 left-1/2 flex h-9 items-center gap-2 rounded-full bg-white/10 px-3 text-white text-xs hover:bg-white/20"
        >
          <X size={14} /> Close
        </button>
        {/* UI-16: explicit min-h-0 lets the flex item shrink so the
            absolutely-positioned <Image fill> resolves to a non-zero
            height inside Safari iOS's url-bar-aware flex container. */}
        <div className="flex w-full min-h-0 flex-1 items-center justify-center overflow-hidden">
          {current.kind === 'VIDEO' ? (
            // biome-ignore lint/a11y/useMediaCaption: caption track not yet authored for IPD-captured clinical videos
            <video src={current.url} controls autoPlay className="max-h-full max-w-full rounded-lg" />
          ) : current.kind === 'DOC' ? (
            <iframe
              title={current.filename}
              src={current.url}
              className="h-full w-full rounded-lg bg-white"
            />
          ) : (
            // Photo / X-ray.  Use `fill` so the image fits the available
            // box; unoptimized because the file is streamed through our
            // /api/files proxy from Drive, not a CDN.
            <div className="relative h-full w-full">
              <Image
                src={current.url}
                alt={current.label || current.filename}
                fill
                sizes="100vw"
                className="rounded-lg object-contain"
                unoptimized
              />
            </div>
          )}
        </div>
        <p className="mt-3 text-[12px] text-white/80">
          {index + 1} / {items.length} · {current.label || current.filename}
        </p>
        {hasPrev && (
          <button
            type="button"
            onClick={() => onChange(index - 1)}
            aria-label="Previous"
            className="-translate-y-1/2 absolute top-1/2 left-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <ChevronLeft size={20} />
          </button>
        )}
        {hasNext && (
          <button
            type="button"
            onClick={() => onChange(index + 1)}
            aria-label="Next"
            className="-translate-y-1/2 absolute top-1/2 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <ChevronRight size={20} />
          </button>
        )}
      </div>
    </div>
  );
}
