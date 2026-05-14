import { isStale, relativeTime } from '@/lib/time';

interface Props {
  lastActivityAt: Date | string | null;
}

export function FreshnessIndicator({ lastActivityAt }: Props) {
  const date = typeof lastActivityAt === 'string' ? new Date(lastActivityAt) : lastActivityAt;
  const stale = isStale(date, 6);
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${
        stale ? 'text-observation' : 'text-muted'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${stale ? 'bg-observation' : 'bg-stable'}`} />
      {relativeTime(date)}
    </span>
  );
}
