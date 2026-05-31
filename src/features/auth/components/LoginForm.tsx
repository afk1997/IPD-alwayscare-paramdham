'use client';
import { Button } from '@/components/ui/Button';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { loginAction } from '../actions';

function safeNext(p: string | null): string {
  if (!p) return '/';
  if (!p.startsWith('/')) return '/';
  if (p.startsWith('//') || p.startsWith('/\\')) return '/';
  return p;
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params?.get('next') ?? null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const result = await loginAction(fd);
      if (result.ok) {
        router.replace(next);
        router.refresh();
      } else {
        setError(result.error ?? 'Login failed');
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-text">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-text">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
      {error && (
        <div role="alert" className="text-sm text-critical">
          {error}
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
