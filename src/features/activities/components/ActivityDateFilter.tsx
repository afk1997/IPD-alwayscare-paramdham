'use client';
import { Input } from '@/components/ui/Input';
import { useState } from 'react';
import { type ActivityFilter, rangeLabel } from '../filter';

interface Props {
  value: ActivityFilter;
  onChange: (f: ActivityFilter) => void;
  minDate: string; // 'YYYY-MM-DD'
  maxDate: string; // 'YYYY-MM-DD'
}

const PRESETS: { label: string; days: 1 | 3 | 7 }[] = [
  { label: 'Today', days: 1 },
  { label: 'Last 3 days', days: 3 },
  { label: 'Last 7 days', days: 7 },
];

function chipClass(active: boolean): string {
  return `rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition ${
    active ? 'border-accent bg-accent text-white' : 'border-line bg-paper text-muted hover:text-text'
  }`;
}

export function ActivityDateFilter({ value, onChange, minDate, maxDate }: Props) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(minDate);
  const [to, setTo] = useState(maxDate);

  const applyCustom = () => {
    const [lo, hi] = from <= to ? [from, to] : [to, from];
    onChange({ kind: 'custom', from: lo, to: hi });
    setOpen(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={chipClass(value.kind === 'all')}
          onClick={() => onChange({ kind: 'all' })}
        >
          All
        </button>
        {PRESETS.map((p) => (
          <button
            key={p.days}
            type="button"
            className={chipClass(value.kind === 'preset' && value.days === p.days)}
            onClick={() => onChange({ kind: 'preset', days: p.days })}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          className={chipClass(value.kind === 'custom')}
          onClick={() => setOpen((o) => !o)}
        >
          {value.kind === 'custom' ? rangeLabel(value, new Date()) : 'Custom range'}
        </button>
      </div>

      {open && (
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-paper p-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="activity-filter-from" className="text-[11px] font-medium text-muted">
              From
            </label>
            <Input
              id="activity-filter-from"
              type="date"
              min={minDate}
              max={maxDate}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-auto"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="activity-filter-to" className="text-[11px] font-medium text-muted">
              To
            </label>
            <Input
              id="activity-filter-to"
              type="date"
              min={minDate}
              max={maxDate}
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-auto"
            />
          </div>
          <button
            type="button"
            className="rounded-md bg-accent px-3 py-2 font-semibold text-sm text-white"
            onClick={applyCustom}
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
