'use client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Check, Pencil, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { type CageRow, deleteCageAction, renameCageAction } from '../actions';

interface Props {
  cages: CageRow[];
  onRenamed: (cage: CageRow) => void;
  onDeleted: (id: string) => void;
}

export function CageList({ cages, onRenamed, onDeleted }: Props) {
  if (cages.length === 0) {
    return <p className="text-sm text-muted">No cages yet. Add your first cage above.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {cages.map((cage) => (
        <CageRowItem key={cage.id} cage={cage} onRenamed={onRenamed} onDeleted={onDeleted} />
      ))}
    </div>
  );
}

interface RowProps {
  cage: CageRow;
  onRenamed: (cage: CageRow) => void;
  onDeleted: (id: string) => void;
}

function CageRowItem({ cage, onRenamed, onDeleted }: RowProps) {
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
        if (result.cage) onRenamed(result.cage);
      }
    });
  };

  const remove = () => {
    if (!window.confirm(`Delete "${cage.name}"? This cannot be undone.`)) return;
    setError(null);
    start(async () => {
      const result = await deleteCageAction(cage.id);
      if (!result.ok) setError(result.error ?? 'Delete failed');
      else onDeleted(cage.id);
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
