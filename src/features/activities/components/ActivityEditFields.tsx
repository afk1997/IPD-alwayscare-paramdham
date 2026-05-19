'use client';
import { FormField } from '@/components/forms/FormField';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Plus, Trash2 } from 'lucide-react';
import { type ActivityType, BATH_TYPES, INTAKE, ROUTES, TESTS } from '../schema';

// biome-ignore lint/suspicious/noExplicitAny: data shape varies per activity type
type Data = Record<string, any>;

interface Props {
  type: ActivityType;
  value: { remarks: string; data: Data };
  onChange: (next: { remarks: string; data: Data }) => void;
}

export function ActivityEditFields({ type, value, onChange }: Props) {
  const set = (patch: Partial<{ remarks: string; data: Data }>) =>
    onChange({ remarks: patch.remarks ?? value.remarks, data: patch.data ?? value.data });
  const setData = (patch: Data) => set({ data: { ...value.data, ...patch } });

  return (
    <div className="flex flex-col gap-4">
      {type === 'ADMISSION' && (
        <FormField label="Summary" required>
          {(id) => (
            <Textarea
              id={id}
              rows={3}
              value={value.data.summary ?? ''}
              onChange={(e) => setData({ summary: e.target.value })}
            />
          )}
        </FormField>
      )}

      {type === 'TREATMENT' && (
        <TreatmentEditor meds={value.data.meds ?? []} onChange={(meds) => setData({ meds })} />
      )}

      {type === 'ROUND' && (
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Temperature (°F)">
            {(id) => (
              <Input
                id={id}
                value={value.data.temp ?? ''}
                onChange={(e) => setData({ temp: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="Pain">
            {(id) => (
              <Input
                id={id}
                value={value.data.pain ?? ''}
                onChange={(e) => setData({ pain: e.target.value })}
                placeholder="0/10 – 10/10"
              />
            )}
          </FormField>
          <FormField label="Appetite">
            {(id) => (
              <Select
                id={id}
                value={value.data.appetite ?? ''}
                onChange={(e) => setData({ appetite: e.target.value })}
              >
                <option value="">—</option>
                <option>Normal</option>
                <option>Partial</option>
                <option>Refused</option>
              </Select>
            )}
          </FormField>
          <FormField label="Hydration">
            {(id) => (
              <Select
                id={id}
                value={value.data.hydration ?? ''}
                onChange={(e) => setData({ hydration: e.target.value })}
              >
                <option value="">—</option>
                <option>Good</option>
                <option>OK</option>
                <option>Mild</option>
                <option>Severe</option>
              </Select>
            )}
          </FormField>
          <FormField label="Wound">
            {(id) => (
              <Input
                id={id}
                value={value.data.wound ?? ''}
                onChange={(e) => setData({ wound: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="Stool / Urine">
            {(id) => (
              <Input
                id={id}
                value={value.data.stool ?? ''}
                onChange={(e) => setData({ stool: e.target.value })}
              />
            )}
          </FormField>
          <div className="col-span-2">
            <FormField label="Progress">
              {(id) => (
                <Select
                  id={id}
                  value={value.data.progress ?? ''}
                  onChange={(e) => setData({ progress: e.target.value })}
                >
                  <option value="">—</option>
                  <option>Worsening</option>
                  <option>Stable</option>
                  <option>Improving</option>
                  <option>Recovered</option>
                </Select>
              )}
            </FormField>
          </div>
          <div className="col-span-2">
            <FormField label="Instructions / Notes">
              {(id) => (
                <Textarea
                  id={id}
                  rows={2}
                  value={value.data.notes ?? ''}
                  onChange={(e) => setData({ notes: e.target.value })}
                />
              )}
            </FormField>
          </div>
        </div>
      )}

      {type === 'DIAGNOSTIC' && (
        <div className="flex flex-col gap-3">
          <FormField label="Tests done">
            <ChipMulti
              options={[...TESTS]}
              value={value.data.tests ?? []}
              onChange={(tests) => setData({ tests })}
            />
          </FormField>
          <FormField label="Findings">
            {(id) => (
              <Textarea
                id={id}
                rows={2}
                value={value.data.findings ?? ''}
                onChange={(e) => setData({ findings: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="Doctor interpretation">
            {(id) => (
              <Textarea
                id={id}
                rows={2}
                value={value.data.interpretation ?? ''}
                onChange={(e) => setData({ interpretation: e.target.value })}
              />
            )}
          </FormField>
        </div>
      )}

      {type === 'SURGERY' && (
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <FormField label="Surgery name" required>
              {(id) => (
                <Input
                  id={id}
                  value={value.data.surgeryName ?? ''}
                  onChange={(e) => setData({ surgeryName: e.target.value })}
                />
              )}
            </FormField>
          </div>
          <FormField label="Surgeon" required>
            {(id) => (
              <Input
                id={id}
                value={value.data.surgeon ?? ''}
                onChange={(e) => setData({ surgeon: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="Duration">
            {(id) => (
              <Input
                id={id}
                value={value.data.duration ?? ''}
                onChange={(e) => setData({ duration: e.target.value })}
                placeholder="45 min"
              />
            )}
          </FormField>
          <div className="col-span-2">
            <FormField label="Anesthesia">
              {(id) => (
                <Input
                  id={id}
                  value={value.data.anesthesia ?? ''}
                  onChange={(e) => setData({ anesthesia: e.target.value })}
                />
              )}
            </FormField>
          </div>
          <div className="col-span-2">
            <FormField label="Findings">
              {(id) => (
                <Textarea
                  id={id}
                  rows={2}
                  value={value.data.findings ?? ''}
                  onChange={(e) => setData({ findings: e.target.value })}
                />
              )}
            </FormField>
          </div>
          <div className="col-span-2">
            <FormField label="Complications">
              {(id) => (
                <Textarea
                  id={id}
                  rows={2}
                  value={value.data.complications ?? ''}
                  onChange={(e) => setData({ complications: e.target.value })}
                />
              )}
            </FormField>
          </div>
          <div className="col-span-2">
            <FormField label="Post-op instructions">
              {(id) => (
                <Textarea
                  id={id}
                  rows={2}
                  value={value.data.postOp ?? ''}
                  onChange={(e) => setData({ postOp: e.target.value })}
                />
              )}
            </FormField>
          </div>
        </div>
      )}

      {type === 'FOOD' && (
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <FormField label="Food type" required>
              {(id) => (
                <Input
                  id={id}
                  value={value.data.foodType ?? ''}
                  onChange={(e) => setData({ foodType: e.target.value })}
                />
              )}
            </FormField>
          </div>
          <FormField label="Quantity">
            {(id) => (
              <Input
                id={id}
                value={value.data.qty ?? ''}
                onChange={(e) => setData({ qty: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="Water">
            {(id) => (
              <Input
                id={id}
                value={value.data.water ?? ''}
                onChange={(e) => setData({ water: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="Intake">
            {(id) => (
              <Select
                id={id}
                value={value.data.intake ?? 'Fully'}
                onChange={(e) => setData({ intake: e.target.value })}
              >
                {INTAKE.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!value.data.vomiting}
              onChange={(e) => setData({ vomiting: e.target.checked })}
              className="h-4 w-4 accent-accent"
            />
            Vomiting after feed
          </label>
        </div>
      )}

      {type === 'BATH' && (
        <div className="flex flex-col gap-3">
          <FormField label="Type" required>
            {(id) => (
              <Select
                id={id}
                value={value.data.bathType ?? 'Regular'}
                onChange={(e) => setData({ bathType: e.target.value })}
              >
                {BATH_TYPES.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField label="Grooming by">
            {(id) => (
              <Input
                id={id}
                value={value.data.groomingBy ?? ''}
                onChange={(e) => setData({ groomingBy: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="Remarks">
            {(id) => (
              <Textarea
                id={id}
                rows={2}
                value={value.data.remarks ?? ''}
                onChange={(e) => setData({ remarks: e.target.value })}
              />
            )}
          </FormField>
        </div>
      )}

      {type === 'WALK' && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Duration">
              {(id) => (
                <Input
                  id={id}
                  value={value.data.duration ?? ''}
                  onChange={(e) => setData({ duration: e.target.value })}
                />
              )}
            </FormField>
            <FormField label="Mobility">
              {(id) => (
                <Select
                  id={id}
                  value={value.data.mobility ?? ''}
                  onChange={(e) => setData({ mobility: e.target.value })}
                >
                  <option value="">—</option>
                  <option>Normal</option>
                  <option>Mild limp</option>
                  <option>Severe limp</option>
                  <option>Unable</option>
                </Select>
              )}
            </FormField>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!value.data.urination}
                onChange={(e) => setData({ urination: e.target.checked })}
                className="h-4 w-4 accent-accent"
              />
              Urinated
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!value.data.stool}
                onChange={(e) => setData({ stool: e.target.checked })}
                className="h-4 w-4 accent-accent"
              />
              Stool passed
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!value.data.assisted}
                onChange={(e) => setData({ assisted: e.target.checked })}
                className="h-4 w-4 accent-accent"
              />
              Assisted
            </label>
          </div>
        </div>
      )}

      <FormField label="Remarks">
        {(id) => (
          <Textarea
            id={id}
            rows={2}
            value={value.remarks}
            onChange={(e) => set({ remarks: e.target.value })}
          />
        )}
      </FormField>
    </div>
  );
}

interface Med {
  name: string;
  dose: string;
  route: string;
  remarks?: string;
}

function TreatmentEditor({ meds, onChange }: { meds: Med[]; onChange: (m: Med[]) => void }) {
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
        // biome-ignore lint/suspicious/noArrayIndexKey: rows are reorderable but identity is positional during edit
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

interface ChipMultiProps {
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
}

function ChipMulti({ options, value, onChange }: ChipMultiProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const checked = value.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(checked ? value.filter((x) => x !== opt) : [...value, opt])}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              checked
                ? 'border-accent bg-accent-soft text-accent-ink'
                : 'border-line bg-paper text-muted hover:bg-paper-2'
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
