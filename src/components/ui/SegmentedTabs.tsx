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
}

export function SegmentedTabs<T extends string>({ value, options, onChange }: Props<T>) {
  return (
    <div className="inline-flex rounded-md border border-line bg-paper-2 p-1">
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            type="button"
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`rounded px-3 py-1.5 text-sm font-medium transition ${
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
