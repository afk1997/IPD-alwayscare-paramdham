import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  icon?: LucideIcon | undefined;
  title: string;
  description?: string | undefined;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-line border-dashed bg-paper p-10 text-center">
      {Icon && (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-paper-2 text-muted">
          <Icon size={18} />
        </div>
      )}
      <div>
        <div className="font-display text-base font-semibold">{title}</div>
        {description && <div className="mt-1 text-sm text-muted">{description}</div>}
      </div>
      {action}
    </div>
  );
}
