'use client';
import { FormField } from '@/components/forms/FormField';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Plus, Trash2 } from 'lucide-react';
import { ROUTES } from '../../schema';

export interface Med {
  name: string;
  dose: string;
  route: string;
  remarks?: string;
}

interface Props {
  meds: Med[];
  onChange: (next: Med[]) => void;
}

export function MedicineEditor({ meds, onChange }: Props) {
  const update = (i: number, patch: Partial<Med>) =>
    onChange(meds.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const add = () => onChange([...meds, { name: '', dose: '', route: 'IV', remarks: '' }]);
  const remove = (i: number) => onChange(meds.filter((_, j) => j !== i));

  return (
    <div className="flex flex-col gap-3">
      <div className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-muted">
        Medicines · {meds.length}
      </div>
      {meds.map((m, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: positional row identity during edit
        <div key={`med-${i}`} className="flex flex-col gap-2 rounded-xl border border-line bg-surface-2 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] font-semibold text-muted">Med {i + 1}</span>
            {meds.length > 1 && (
              <button
                type="button"
                onClick={() => remove(i)}
                className="flex items-center gap-1 text-[12px] font-semibold text-critical"
              >
                <Trash2 size={12} /> Remove
              </button>
            )}
          </div>
          <FormField label="Name">
            {(id) => <Input id={id} value={m.name} onChange={(e) => update(i, { name: e.target.value })} />}
          </FormField>
          <div className="grid grid-cols-2 gap-2">
            <FormField label="Dose">
              {(id) => <Input id={id} value={m.dose} onChange={(e) => update(i, { dose: e.target.value })} />}
            </FormField>
            <FormField label="Route">
              {(id) => (
                <Select id={id} value={m.route} onChange={(e) => update(i, { route: e.target.value })}>
                  {ROUTES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
          </div>
          <FormField label="Remarks">
            {(id) => (
              <Input
                id={id}
                value={m.remarks ?? ''}
                onChange={(e) => update(i, { remarks: e.target.value })}
              />
            )}
          </FormField>
        </div>
      ))}
      <Button type="button" variant="soft" size="sm" onClick={add} className="self-start">
        <Plus size={14} /> Add medicine
      </Button>
    </div>
  );
}
