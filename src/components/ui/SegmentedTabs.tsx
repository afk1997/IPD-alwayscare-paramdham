'use client';
interface Option<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface Props<T extends string> {
  value: T;
  options: Option<T>[];
  onChange: (v: T) => void;
  fill?: boolean;
}

export function SegmentedTabs<T extends string>({ value, options, onChange, fill = false }: Props<T>) {
  return (
    <div className={`inline-flex rounded-xl border border-line bg-surface-2 p-1 ${fill ? 'w-full' : ''}`}>
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            type="button"
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`${fill ? 'flex-1' : ''} rounded-lg px-3 py-2 text-sm font-semibold transition ${
              isActive ? 'bg-paper text-text shadow-sm' : 'text-muted hover:text-text'
            }`}
          >
            {opt.label}
            {opt.count !== undefined && (
              <span className={`ml-1.5 text-xs ${isActive ? 'text-muted' : 'text-soft'}`}>{opt.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
