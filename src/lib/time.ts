const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

export function relativeTime(date: Date | string | null | undefined, now: Date = new Date()): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  const diff = now.getTime() - d.getTime();
  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) {
    const mins = Math.floor(diff / MINUTE);
    return `${mins}m ago`;
  }
  if (diff < 24 * HOUR) {
    const hrs = Math.floor(diff / HOUR);
    return `${hrs}h ago`;
  }
  const days = Math.floor(diff / (24 * HOUR));
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  // Force `en-GB` + `hour12: false` for a clinically-readable 24h stamp
  // that's identical on Node (server) and on browser (whatever locale).
  // Using `undefined` locale here was a hydration-bug source — Node's
  // ICU defaults to `en-US` ("10:41 PM"), an Indian browser renders
  // `en-IN` ("10:41 pm"), and React logged a mismatch on every render.
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

// SSR-safe wall-clock formatter — "21:41" rather than "10:41 PM"/"10:41 pm".
export function clockTime(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function isStale(lastActivity: Date | null | undefined, thresholdHours = 6): boolean {
  if (!lastActivity) return true;
  return Date.now() - lastActivity.getTime() > thresholdHours * HOUR;
}
