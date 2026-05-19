'use client';

// biome-ignore lint/suspicious/noExplicitAny: data shape varies per activity type
export type Data = Record<string, any>;

export interface EditFieldsProps {
  value: { data: Data };
  setData: (patch: Data) => void;
}

interface ChipMultiProps {
  options: readonly string[];
  value: string[];
  onChange: (next: string[]) => void;
}

export function ChipMulti({ options, value, onChange }: ChipMultiProps) {
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
