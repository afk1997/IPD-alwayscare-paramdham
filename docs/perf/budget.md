# Performance budget

Targets the spec's goals.  Each Phase's measurement gate compares
against this.  See `docs/superpowers/specs/2026-05-28-app-performance-design.md`
for the rationale behind each target.

| Metric                                                       | Budget                                  | Page |
|--------------------------------------------------------------|-----------------------------------------|------|
| FCP (4G, throttled, Lighthouse mobile preset)                | < 1.5 s                                 | `/patients`, `/patients/[id]` |
| LCP                                                          | < 2.5 s                                 | `/patients/[id]` |
| INP (activity sheet save click)                              | < 200 ms                                | `/patients/[id]` |
| Server HTML response (warm, Server-Timing total)             | < 200 ms                                | All `(app)` routes |
| `/api/files` Server-Timing total (warm, signed path)         | < 50 ms (edge hit ~5 ms)                | `/api/files/[id]` |
| `/api/files` Server-Timing total (warm, cookie path)         | < 400 ms                                | `/api/files/[id]` |
| Fast Origin Transfer (Vercel monthly)                        | < 3 GB / month                          | dashboard |
| Image Optimization Transforms (monthly steady-state)         | < 1K / month                            | dashboard |
| Edge cache hit ratio for `/api/files/*?sig=...`              | > 80%                                   | dashboard |
