import { BrandMark } from '@/components/shell/BrandMark';

export const metadata = { title: 'Offline — IPD Always Care' };

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg px-6 text-center text-text">
      <BrandMark size={56} />
      <h1 className="font-display text-xl font-bold">You're offline</h1>
      <p className="max-w-xs text-muted text-sm">
        Reconnect to the internet to continue. The app shell is cached so it loads instantly when you're back.
      </p>
    </div>
  );
}
