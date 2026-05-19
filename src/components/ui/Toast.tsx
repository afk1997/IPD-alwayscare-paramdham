'use client';
import { X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

export interface ToastAction {
  label: string;
  onClick: () => void | Promise<void>;
}

export interface ToastInput {
  message: string;
  action?: ToastAction;
  /** ms; defaults to 5000 */
  duration?: number;
}

interface Toast extends ToastInput {
  id: string;
  duration: number;
}

interface ToastContextValue {
  showToast: (input: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

interface Props {
  children: React.ReactNode;
}

export function ToastProvider({ children }: Props) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
    const handle = timersRef.current.get(id);
    if (handle) {
      clearTimeout(handle);
      timersRef.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (input: ToastInput) => {
      const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const duration = input.duration ?? 5000;
      const toast: Toast = { ...input, id, duration };
      setToasts((cur) => [...cur, toast]);
      const handle = setTimeout(() => dismiss(id), duration);
      timersRef.current.set(id, handle);
    },
    [dismiss],
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const handle of timers.values()) clearTimeout(handle);
      timers.clear();
    };
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
        <ul className="pointer-events-auto flex flex-col items-center gap-2">
          {toasts.map((t) => (
            <li
              key={t.id}
              className="flex items-center gap-3 rounded-xl border border-line bg-paper px-4 py-2.5 shadow-lg"
            >
              <span className="text-[13px] text-text">{t.message}</span>
              {t.action && (
                <button
                  type="button"
                  onClick={async () => {
                    dismiss(t.id);
                    await t.action?.onClick();
                  }}
                  className="font-semibold text-[12.5px] text-accent hover:underline"
                >
                  {t.action.label}
                </button>
              )}
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => dismiss(t.id)}
                className="flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-paper-2"
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </ToastContext.Provider>
  );
}
