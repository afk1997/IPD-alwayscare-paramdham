'use client';
import { Download, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) {
      setInstalled(true);
      return;
    }
    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', onBIP);
    window.addEventListener('appinstalled', onInstalled);

    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua) && !/CriOS|FxiOS/.test(ua)) setIosHint(true);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBIP);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed || dismissed) return null;
  if (!deferred && !iosHint) return null;

  return (
    <div className="fixed inset-x-0 bottom-[76px] z-40 mx-auto flex max-w-md items-center gap-3 rounded-xl border border-line bg-paper px-4 py-2.5 shadow-lg md:bottom-4">
      <Download size={16} className="shrink-0 text-accent" />
      {deferred ? (
        <>
          <span className="flex-1 text-[13px] text-text">Install Arham IPD for quick access</span>
          <button
            type="button"
            className="font-semibold text-[12.5px] text-accent hover:underline"
            onClick={async () => {
              await deferred.prompt();
              setDeferred(null);
            }}
          >
            Install
          </button>
        </>
      ) : (
        <span className="flex-1 text-[12.5px] text-muted">Install: tap Share → Add to Home Screen</span>
      )}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setDismissed(true)}
        className="flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-paper-2"
      >
        <X size={12} />
      </button>
    </div>
  );
}
