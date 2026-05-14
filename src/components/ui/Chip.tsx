import type { HTMLAttributes } from 'react';

interface Props extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'accent';
}

export function Chip({ variant = 'default', className = '', ...rest }: Props) {
  const cls = variant === 'accent' ? 'bg-accent-soft text-accent-ink' : 'bg-paper-2 text-text';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cls} ${className}`}
      {...rest}
    />
  );
}
