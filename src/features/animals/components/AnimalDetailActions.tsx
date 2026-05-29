'use client';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { ActivityQuickAdd } from '@/features/activities/components/ActivityQuickAdd';
import { invalidateLifecycleAction, revalidateLifecycleAction } from '@/features/animals/lifecycle/actions';
import { useActiveUsers } from '@/features/users/ActiveUsersContext';
import { LogOut, MoreHorizontal, Pencil, Plus, Skull } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { PatientShareButton } from './PatientShareButton';

interface Props {
  animalId: string;
  // UI-14: hide lifecycle actions for animals that are no longer admitted.
  status?: 'CRITICAL' | 'STABLE' | 'OBSERVATION' | 'DISCHARGED' | 'DECEASED';
  canReopen?: boolean;
  canRevalidate?: boolean;
}

export function AnimalDetailActions({ animalId, status, canReopen, canRevalidate }: Props) {
  const [quickOpen, setQuickOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isClosed = status === 'DISCHARGED' || status === 'DECEASED';
  const { currentUserRole } = useActiveUsers();
  const canWrite = currentUserRole !== 'VIEWER';
  const isSuperAdmin = currentUserRole === 'SUPER_ADMIN';
  const caseLocked = isClosed && !isSuperAdmin;
  const [lifecyclePending, startLifecycle] = useTransition();
  const router = useRouter();
  const { showToast } = useToast();
  const runLifecycle = (fn: (id: string) => Promise<{ ok: boolean; error?: string }>, confirmMsg: string) => {
    if (!window.confirm(confirmMsg)) return;
    startLifecycle(async () => {
      const r = await fn(animalId);
      if (r.ok) {
        showToast({ message: 'Done' });
        router.refresh();
      } else {
        showToast({ message: r.error ?? 'Failed' });
      }
    });
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  return (
    <div className="relative flex items-center gap-2" ref={menuRef}>
      {canWrite && !caseLocked && (
        <Button size="sm" onClick={() => setQuickOpen(true)}>
          <Plus size={14} />
          Log activity
        </Button>
      )}
      {canReopen && (
        <Button
          size="sm"
          variant="ghost"
          disabled={lifecyclePending}
          onClick={() =>
            runLifecycle(
              invalidateLifecycleAction,
              'Reopen this case? It returns the patient to Observation; the death/discharge record is kept but marked invalidated.',
            )
          }
        >
          Reopen case
        </Button>
      )}
      {canRevalidate && (
        <Button
          size="sm"
          variant="ghost"
          disabled={lifecyclePending}
          onClick={() =>
            runLifecycle(
              revalidateLifecycleAction,
              'Re-validate? This re-declares the patient as deceased/discharged.',
            )
          }
        >
          Re-validate
        </Button>
      )}
      <PatientShareButton animalId={animalId} />
      {canWrite && !caseLocked && (
        <>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="More actions"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-line bg-paper text-muted hover:bg-paper-2"
          >
            <MoreHorizontal size={16} />
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-11 z-30 flex w-48 flex-col rounded-lg border border-line bg-paper p-1 shadow-xl"
            >
              <Link
                href={`/patients/${animalId}/edit`}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 rounded px-2.5 py-2 text-sm hover:bg-paper-2"
              >
                <Pencil size={14} />
                Edit details
              </Link>
              {!isClosed && (
                <>
                  <Link
                    href={`/patients/${animalId}/discharge`}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 rounded px-2.5 py-2 text-sm hover:bg-paper-2"
                  >
                    <LogOut size={14} />
                    Discharge
                  </Link>
                  <Link
                    href={`/patients/${animalId}/death`}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 rounded px-2.5 py-2 text-sm text-critical hover:bg-paper-2"
                  >
                    <Skull size={14} />
                    Record death
                  </Link>
                </>
              )}
            </div>
          )}
        </>
      )}
      {canWrite && !caseLocked && (
        <ActivityQuickAdd animalId={animalId} open={quickOpen} onClose={() => setQuickOpen(false)} />
      )}
    </div>
  );
}
