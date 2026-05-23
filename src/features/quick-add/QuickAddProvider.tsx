'use client';
import type { ActivityType } from '@/features/activities/schema';
import { useActiveUsers } from '@/features/users/ActiveUsersContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { QuickAddModal } from './QuickAddModal';

export interface QuickAddPrefill {
  /**
   * When set, the modal skips the menu step and goes straight to the
   * patient picker for that purpose.  For 'admission' the modal closes
   * itself and navigates to /patients/new instead — there's no patient
   * to pick yet.
   */
  action: 'admission' | 'activity' | 'document' | 'lifecycle';
  /** Only meaningful with action='activity' — pre-selects the type and
   *  skips the activity-type chooser after a patient is picked. */
  activityType?: ActivityType;
}

interface QuickAddContextValue {
  isOpen: boolean;
  open: (prefill?: QuickAddPrefill) => void;
  close: () => void;
}

const QuickAddContext = createContext<QuickAddContextValue | null>(null);

export function useQuickAdd(): QuickAddContextValue {
  const ctx = useContext(QuickAddContext);
  if (!ctx) throw new Error('useQuickAdd must be used inside QuickAddProvider');
  return ctx;
}

interface Props {
  children: React.ReactNode;
}

export function QuickAddProvider({ children }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [prefill, setPrefill] = useState<QuickAddPrefill | null>(null);
  const router = useRouter();
  const search = useSearchParams();
  const { currentUserRole } = useActiveUsers();
  // VIEWER has no write capability; every entry point this provider
  // exposes leads to a server-side RBAC rejection. Gate both the
  // programmatic open() and the global N keyboard shortcut here so the
  // form chrome never appears.
  const canWrite = currentUserRole !== 'VIEWER';

  const open = useCallback(
    (next?: QuickAddPrefill) => {
      if (!canWrite) return;
      setPrefill(next ?? null);
      setIsOpen(true);
    },
    [canWrite],
  );
  const close = useCallback(() => {
    setIsOpen(false);
    setPrefill(null);
  }, []);

  // Auto-open when arriving with ?quickAdd=1; then strip the param.
  useEffect(() => {
    if (search.get('quickAdd') === '1') {
      if (canWrite) setIsOpen(true);
      const next = new URLSearchParams(search.toString());
      next.delete('quickAdd');
      const qs = next.toString();
      router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
    }
  }, [search, router, canWrite]);

  // Keyboard shortcut: N opens QuickAdd (except inside inputs, and never
  // for VIEWER — see canWrite above).
  useEffect(() => {
    if (!canWrite) return;
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setPrefill(null);
        setIsOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canWrite]);

  const value = useMemo<QuickAddContextValue>(() => ({ isOpen, open, close }), [isOpen, open, close]);

  return (
    <QuickAddContext.Provider value={value}>
      {children}
      <QuickAddModal open={isOpen} onClose={close} prefill={prefill} />
    </QuickAddContext.Provider>
  );
}
