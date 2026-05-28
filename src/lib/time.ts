const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

// The clinic is in India (UTC+5:30, no DST). Pin all date logic to IST
// explicitly: TZ is a Vercel *reserved* env var and process.env.TZ does NOT
// take effect on the serverless runtime, so we can't rely on the process zone.
export const IST_TZ = 'Asia/Kolkata';
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/**
 * Start of the IST calendar day containing `at`, returned as a UTC instant.
 * Uses setUTCHours, so it is runtime-timezone-independent — correct whether the
 * server runs in UTC (Vercel) or IST (local dev).
 */
export function startOfISTDay(at: Date = new Date()): Date {
  const shifted = new Date(at.getTime() + IST_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - IST_OFFSET_MS);
}

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
  return d.toLocaleDateString('en-GB', { timeZone: IST_TZ });
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
    timeZone: IST_TZ,
  });
}

// SSR-safe wall-clock formatter — "21:41" rather than "10:41 PM"/"10:41 pm".
export function clockTime(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: IST_TZ,
  });
}

export function isStale(lastActivity: Date | null | undefined, thresholdHours = 6): boolean {
  if (!lastActivity) return true;
  return Date.now() - lastActivity.getTime() > thresholdHours * HOUR;
}
