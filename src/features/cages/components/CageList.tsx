'use client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Check, Pencil, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { deleteCageAction, renameCageAction } from '../actions';

interface Occupant {
  id: string;
  name: string;
  species: string;
  status: string;
}
interface Cage {
  id: string;
  name: string;
  occupant: Occupant | null;
}

export function CageList({ cages }: { cages: Cage[] }) {
  if (cages.length === 0) {
    return <p className="text-sm text-muted">No cages yet. Add your first cage above.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {cages.map((cage) => (
        <CageRow key={cage.id} cage={cage} />
      ))}
    </div>
  );
}

function CageRow({ cage }: { cage: Cage }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(cage.name);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    setError(null);
    start(async () => {
      const result = await renameCageAction(cage.id, name.trim());
      if (!result.ok) setError(result.error ?? 'Rename failed');
      else {
        setEditing(false);
        router.refresh();
      }
    });
  };

  const remove = () => {
    if (!window.confirm(`Delete "${cage.name}"? This cannot be undone.`)) return;
    setError(null);
    start(async () => {
      const result = await deleteCageAction(cage.id);
      if (!result.ok) setError(result.error ?? 'Delete failed');
      else router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-line bg-paper p-3">
      <div className="flex items-center justify-between gap-3">
        {editing ? (
          <div className="flex flex-1 items-center gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Cage name" />
            <Button size="sm" onClick={save} disabled={pending || name.trim().length === 0}>
              <Check size={14} />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setName(cage.name);
                setError(null);
              }}
              disabled={pending}
            >
              <X size={14} />
            </Button>
          </div>
        ) : (
          <>
            <div className="min-w-0">
              <span className="font-medium">{cage.name}</span>
              <span className="ml-2 text-xs text-muted">
                {cage.occupant ? (
                  <Link href={`/patients/${cage.occupant.id}`} className="text-accent hover:underline">
                    {cage.occupant.name} · {cage.occupant.species}
                  </Link>
                ) : (
                  'Empty'
                )}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)} disabled={pending}>
                <Pencil size={14} />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={remove}
                disabled={pending || cage.occupant !== null}
                title={cage.occupant ? 'Free the cage before deleting' : 'Delete cage'}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          </>
        )}
      </div>
      {error && (
        <div role="alert" className="text-sm text-critical">
          {error}
        </div>
      )}
    </div>
  );
}
