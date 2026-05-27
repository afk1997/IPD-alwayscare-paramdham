'use client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createCageAction } from '../actions';

export function AddCageForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const result = await createCageAction(name.trim());
      if (!result.ok) setError(result.error ?? 'Could not add cage');
      else {
        setName('');
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New cage name (e.g. Cage 1, ICU-2)"
          aria-label="New cage name"
        />
        <Button type="submit" disabled={pending || name.trim().length === 0}>
          {pending ? 'Adding…' : 'Add cage'}
        </Button>
      </div>
      {error && (
        <div role="alert" className="text-sm text-critical">
          {error}
        </div>
      )}
    </form>
  );
}
