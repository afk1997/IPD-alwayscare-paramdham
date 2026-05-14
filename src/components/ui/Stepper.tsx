interface Props {
  steps: string[];
  current: number;
}

export function Stepper({ steps, current }: Props) {
  return (
    <ol className="flex w-full items-center gap-2">
      {steps.map((label, idx) => {
        const isDone = idx < current;
        const isActive = idx === current;
        const tone = isActive
          ? 'bg-accent text-accent-fg'
          : isDone
            ? 'bg-accent-soft text-accent-ink'
            : 'bg-paper-2 text-muted';
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${tone}`}
            >
              {idx + 1}
            </span>
            <span
              className={`hidden flex-1 truncate text-xs font-medium md:inline ${
                isActive ? 'text-text' : 'text-muted'
              }`}
            >
              {label}
            </span>
            {idx < steps.length - 1 && <span className={`h-px flex-1 ${isDone ? 'bg-accent' : 'bg-line'}`} />}
          </li>
        );
      })}
    </ol>
  );
}
