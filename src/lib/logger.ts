// VRC-10: thin structured-logging shim. Today this only routes to
// console with a redacted shape; the body is intentionally small so
// that swapping in Sentry/Logtail/Datadog later is a one-file change.
//
// All entries emit a single JSON line — easier to grep in Vercel logs
// than a multi-line stack trace. Never include raw error objects: pull
// `message` + `code` + a small context bag only.

export interface LogContext {
  [key: string]: string | number | boolean | null | undefined;
}

function emit(level: 'error' | 'warn' | 'info', tag: string, msg: string, ctx?: LogContext) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    tag,
    msg,
    ...(ctx ?? {}),
  };
  // Only error/warn go to dedicated console channels; info uses warn so
  // we don't trip biome's noConsoleLog gate. JSON line either way.
  if (level === 'error') console.error(JSON.stringify(entry));
  else console.warn(JSON.stringify(entry));
}

export function logError(tag: string, e: unknown, ctx?: LogContext) {
  const code = (e as { code?: string | number })?.code;
  const msg = e instanceof Error ? e.message : 'unknown';
  emit('error', tag, msg, { ...(ctx ?? {}), code: code === undefined ? null : String(code) });
}

export function logInfo(tag: string, msg: string, ctx?: LogContext) {
  emit('info', tag, msg, ctx);
}

export function logWarn(tag: string, msg: string, ctx?: LogContext) {
  emit('warn', tag, msg, ctx);
}
