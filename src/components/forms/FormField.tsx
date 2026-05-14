import { type ReactNode, useId } from 'react';

interface Props {
  label: string;
  htmlFor?: string | undefined;
  error?: string | undefined;
  hint?: string | undefined;
  required?: boolean | undefined;
  children: ReactNode | ((id: string) => ReactNode);
}

export function FormField({ label, htmlFor, error, hint, required, children }: Props) {
  const autoId = useId();
  const id = htmlFor ?? autoId;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-text">
        {label}
        {required && <span className="ml-1 text-critical">*</span>}
      </label>
      {typeof children === 'function' ? children(id) : children}
      {error && <div className="text-xs text-critical">{error}</div>}
      {hint && !error && <div className="text-xs text-muted">{hint}</div>}
    </div>
  );
}

interface SectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function FormSection({ title, description, children }: SectionProps) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="font-display text-base font-semibold">{title}</h3>
        {description && <p className="mt-1 text-xs text-muted">{description}</p>}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}
