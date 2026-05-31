'use client';
import { useToast } from '@/components/ui/Toast';
import { useEffect } from 'react';

export function PwaController() {
  const { showToast } = useToast();

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return; // SW is prod-only (serwist disables it in dev)
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const sw = navigator.serviceWorker;
    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    sw.addEventListener('controllerchange', onControllerChange);

    const promptRefresh = (worker: ServiceWorker) =>
      showToast({
        message: 'New version available',
        duration: 60 * 60 * 1000,
        action: { label: 'Refresh', onClick: () => worker.postMessage({ type: 'SKIP_WAITING' }) },
      });

    sw.register('/sw.js')
      .then((reg) => {
        if (reg.waiting) promptRefresh(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && sw.controller) {
              promptRefresh(installing);
            }
          });
        });
      })
      .catch(() => {
        /* SW unsupported/blocked — app still works as a normal web app */
      });

    return () => sw.removeEventListener('controllerchange', onControllerChange);
  }, [showToast]);

  return null;
}
