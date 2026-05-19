'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { QuickAddModal } from './QuickAddModal';

interface QuickAddContextValue {
  isOpen: boolean;
  open: () => void;
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
  const router = useRouter();
  const search = useSearchParams();

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  // Auto-open when arriving with ?quickAdd=1; then strip the param.
  useEffect(() => {
    if (search.get('quickAdd') === '1') {
      setIsOpen(true);
      const next = new URLSearchParams(search.toString());
      next.delete('quickAdd');
      const qs = next.toString();
      router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
    }
  }, [search, router]);

  // Keyboard shortcut: N opens QuickAdd (except inside inputs).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setIsOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const value = useMemo<QuickAddContextValue>(() => ({ isOpen, open, close }), [isOpen, open, close]);

  return (
    <QuickAddContext.Provider value={value}>
      {children}
      <QuickAddModal open={isOpen} onClose={close} />
    </QuickAddContext.Provider>
  );
}
