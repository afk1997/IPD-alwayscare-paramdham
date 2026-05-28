/**
 * Tiny accumulator that produces a `Server-Timing` header value.
 * Used to measure where time goes in request handlers and (via
 * console.log) in RSC renders where setting response headers from
 * a Server Component isn't supported.
 *
 * Usage:
 *   const t = createTimings();
 *   await doThing();
 *   t.mark('thing');
 *   await doOther();
 *   t.mark('other');
 *   res.headers.set('Server-Timing', t.header());
 */
export interface Timings {
  mark(name: string): void;
  header(): string;
}

export function createTimings(): Timings {
  const start = performance.now();
  const marks: Array<[string, number]> = [];
  return {
    mark(name: string) {
      if (!/^[!#$%&'*+\-.^_`|~\w]+$/.test(name)) {
        throw new Error(`server-timing: invalid metric name "${name}"`);
      }
      marks.push([name, performance.now() - start]);
    },
    header() {
      const total: [string, number] = ['total', performance.now() - start];
      const all = [...marks, total];
      return all.map(([n, d]) => `${n};dur=${d.toFixed(2)}`).join(',');
    },
  };
}
