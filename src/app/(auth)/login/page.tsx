import { BrandMark } from '@/components/shell/BrandMark';
import { LoginForm } from '@/features/auth/components/LoginForm';
import { Suspense } from 'react';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-8 rounded-lg border border-line bg-paper p-8 shadow-sm">
        <div className="flex flex-col items-center gap-3">
          <BrandMark size={44} />
          <h1 className="font-display text-xl font-bold tracking-tight">Arham Always Care</h1>
          <p className="text-xs uppercase tracking-[0.14em] text-muted">IPD</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
