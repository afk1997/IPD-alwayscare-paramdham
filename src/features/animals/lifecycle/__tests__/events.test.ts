import { describe, expect, it } from 'vitest';
import { type AnimalForEvents, buildLifecycleEvents } from '../events';

const base: AnimalForEvents = {
  admittedAt: new Date('2026-05-26T09:00:00.000Z'),
  complaint: 'Fracture',
  createdBy: { name: 'Asha' },
  deathRecord: null,
  dischargeRecord: null,
};

describe('buildLifecycleEvents', () => {
  it('always emits an admission event', () => {
    const ev = buildLifecycleEvents(base);
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({
      kind: 'admission',
      detail: 'Fracture',
      byName: 'Asha',
      invalidated: false,
    });
    expect(ev[0]?.at).toBe('2026-05-26T09:00:00.000Z');
  });

  it('emits a death event from the record, with invalidation flag + name', () => {
    const ev = buildLifecycleEvents({
      ...base,
      deathRecord: {
        causeOfDeath: 'Cardiac arrest',
        diedAt: new Date('2026-05-28T09:40:00.000Z'),
        recordedBy: { name: 'Dr. Mehta' },
        invalidatedAt: new Date('2026-05-29T10:00:00.000Z'),
        invalidatedBy: { name: 'Boss' },
      },
    });
    const death = ev.find((e) => e.kind === 'death');
    expect(death).toMatchObject({
      detail: 'Cardiac arrest',
      byName: 'Dr. Mehta',
      invalidated: true,
      invalidatedByName: 'Boss',
    });
  });

  it('emits a non-invalidated discharge event', () => {
    const ev = buildLifecycleEvents({
      ...base,
      dischargeRecord: {
        summary: 'Recovered',
        dischargedAt: new Date('2026-05-27T12:00:00.000Z'),
        dischargedBy: { name: 'Dr. Iyer' },
        invalidatedAt: null,
        invalidatedBy: null,
      },
    });
    const d = ev.find((e) => e.kind === 'discharge');
    expect(d).toMatchObject({
      detail: 'Recovered',
      byName: 'Dr. Iyer',
      invalidated: false,
      invalidatedByName: null,
    });
  });
});
