'use client';
import { Photo } from '@/components/media/Photo';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';
import { useFocusTrap } from '@/lib/hooks/useFocusTrap';
import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useTransition } from 'react';
import { invalidateLifecycleAction, revalidateLifecycleAction } from '../actions';
import type { LifecycleEvent } from '../events';

export interface LifecycleDocLite {
  id: string;
  name: string;
  kind: string;
  url: string | null;
  mediaKind: 'PHOTO' | 'VIDEO' | 'XRAY' | 'DOC' | null;
}

interface Props {
  event: LifecycleEvent | null; // a 'death' or 'discharge' event (admission never opens this)
  animalId: string;
  currentUserRole?: string;
  docs: LifecycleDocLite[];
  onClose: () => void;
}

export function LifecycleRecordSheet({ event, animalId, currentUserRole, docs, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, !!event);
  useBodyScrollLock(!!event);
  const [pending, start] = useTransition();
  const router = useRouter();
  const { showToast } = useToast();
  if (!event) return null;
  const isSuper = currentUserRole === 'SUPER_ADMIN';
  const title = event.kind === 'death' ? 'Death record' : 'Discharge record';
  const run = (fn: (id: string) => Promise<{ ok: boolean; error?: string }>, msg: string) => {
    if (!window.confirm(msg)) return;
    start(async () => {
      const r = await fn(animalId);
      showToast({ message: r.ok ? 'Done' : (r.error ?? 'Failed') });
      if (r.ok) {
        onClose();
        router.refresh();
      }
    });
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" aria-modal="true">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/50"
      />
      <div
        ref={dialogRef}
        className="relative z-10 w-full max-w-md rounded-t-2xl bg-paper p-5 md:rounded-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {event.invalidated && (
          <p className="mb-3 rounded-md bg-paper-2 px-3 py-2 text-[12.5px] text-observation">
            Invalidated{event.invalidatedByName ? ` by ${event.invalidatedByName}` : ''}
          </p>
        )}
        <dl className="flex flex-col gap-2 text-sm">
          <div>
            <dt className="text-muted text-xs">{event.kind === 'death' ? 'Cause of death' : 'Summary'}</dt>
            <dd>{event.detail ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-muted text-xs">Logged by</dt>
            <dd>{event.byName ?? '—'}</dd>
          </div>
        </dl>
        {docs.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 font-semibold text-[12px] text-muted uppercase tracking-wide">Documents</h3>
            <div className="grid grid-cols-4 gap-2">
              {docs.map((d) => (
                <Photo
                  key={d.id}
                  seed={d.id}
                  src={d.url ?? undefined}
                  kind={
                    d.mediaKind === 'VIDEO'
                      ? 'video'
                      : d.mediaKind === 'XRAY'
                        ? 'xray'
                        : d.mediaKind === 'DOC'
                          ? 'doc'
                          : 'photo'
                  }
                  alt={d.name}
                  rounded={10}
                  className="h-16 w-16"
                  sizes="64px"
                />
              ))}
            </div>
          </div>
        )}
        {isSuper && (
          <div className="mt-5">
            {event.invalidated ? (
              <Button
                variant="ghost"
                disabled={pending}
                onClick={() =>
                  run(
                    revalidateLifecycleAction,
                    'Re-validate? This re-declares the patient as deceased/discharged.',
                  )
                }
              >
                Re-validate
              </Button>
            ) : (
              <Button
                variant="ghost"
                disabled={pending}
                onClick={() =>
                  run(
                    invalidateLifecycleAction,
                    'Reopen this case? It returns the patient to Observation; the record is kept but marked invalidated.',
                  )
                }
              >
                Reopen case
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
