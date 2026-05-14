import type { HTMLAttributes } from 'react';

type Status = 'critical' | 'stable' | 'observation' | 'neutral';

const styles: Record<Status, string> = {
  critical: 'bg-critical-bg text-critical',
  stable: 'bg-stable-bg text-stable',
  observation: 'bg-observation-bg text-observation',
  neutral: 'bg-paper-2 text-muted',
};

interface Props extends HTMLAttributes<HTMLSpanElement> {
  status: Status;
}

export function Pill({ status, className = '', children, ...rest }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${styles[status]} ${className}`}
      {...rest}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
