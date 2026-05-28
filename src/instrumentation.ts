/**
 * Runs once at server startup (Next.js instrumentation hook).
 *
 * Pin the Node server runtime to India Standard Time. We can't use the `TZ`
 * env var — Vercel reserves it — so we set it here instead. The clinic is in
 * India and India observes no DST, so a fixed Asia/Kolkata runtime is correct
 * year-round. This makes server-side day boundaries (the "today" timeline and
 * daily-report `setHours(0,0,0,0)` ranges) and server-rendered timestamps use
 * IST, matching the browser. The database still stores UTC; report/share text
 * additionally pins Asia/Kolkata explicitly.
 */
export function register() {
  process.env.TZ = 'Asia/Kolkata';
}
