'use client';

interface Option<V extends string> {
  value: V;
  label: string;
}

interface Props<V extends string> {
  value: V | '';
  onChange: (next: V) => void;
  options: readonly Option<V>[] | readonly V[];
  /** When true, an empty value is allowed so no option starts selected. */
  allowEmpty?: boolean;
}

export function Segmented<V extends string>({ value, onChange, options, allowEmpty }: Props<V>) {
  const normalized: Option<V>[] = (options as readonly (Option<V> | V)[]).map((o) =>
    typeof o === 'string' ? ({ value: o, label: o } as Option<V>) : o,
  );
  return (
    <div className="flex gap-1 rounded-xl bg-paper-2 p-1">
      {normalized.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => (allowEmpty && active ? onChange('' as V) : onChange(o.value))}
            className={`flex-1 rounded-lg px-2.5 py-1.5 text-center font-semibold text-[12.5px] transition ${
              active ? 'bg-paper text-accent-ink shadow-sm' : 'text-muted hover:text-text'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

interface ChipMultiProps<V extends string> {
  value: V[];
  onChange: (next: V[]) => void;
  options: readonly V[];
}

export function ChipMulti<V extends string>({ value, onChange, options }: ChipMultiProps<V>) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = value.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(active ? value.filter((v) => v !== opt) : [...value, opt])}
            className={`rounded-full border px-2.5 py-1 font-semibold text-[12px] transition ${
              active
                ? 'border-accent bg-accent text-accent-fg'
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
