import { describe, expect, it } from 'vitest';
import { activityDetailLines } from '../summary';

describe('activityDetailLines (dedup vs headline summary)', () => {
  it('TREATMENT — only emits remarks; meds covered by headline', () => {
    expect(
      activityDetailLines({
        type: 'TREATMENT',
        data: { meds: [{ name: 'Amoxiclav', dose: '20mg/kg', route: 'Oral' }] },
        remarks: 'dose adjusted',
      }),
    ).toEqual(['Remarks: dose adjusted']);
  });

  it('ROUND — skips temp/pain/progress (in headline) but emits the rest', () => {
    expect(
      activityDetailLines({
        type: 'ROUND',
        data: {
          temp: '38.5°C',
          pain: 'mild',
          progress: 'Stable',
          appetite: 'Partial',
          hydration: 'OK',
          wound: 'clean',
          stool: 'normal',
          notes: 'responsive',
        },
        remarks: null,
      }),
    ).toEqual(['Appetite: Partial', 'Hydration: OK', 'Wound: clean', 'Stool: normal', 'Notes: responsive']);
  });

  it('ROUND — skips notes when it WAS the headline fallback', () => {
    // temp/pain/progress all empty → summary falls back to notes; detail
    // must NOT repeat notes.
    expect(
      activityDetailLines({
        type: 'ROUND',
        data: { notes: 'Pre-surgical, NPO since 22:00 yesterday' },
        remarks: null,
      }),
    ).toEqual([]);
  });

  it('DIAGNOSTIC — only emits interpretation; tests + findings in headline', () => {
    expect(
      activityDetailLines({
        type: 'DIAGNOSTIC',
        data: {
          tests: ['Blood test'],
          findings: 'mild leukocytosis',
          interpretation: 'likely viral',
        },
        remarks: null,
      }),
    ).toEqual(['Interpretation: likely viral']);
  });

  it('SURGERY — skips surgeryName/duration/surgeon; keeps the rest', () => {
    expect(
      activityDetailLines({
        type: 'SURGERY',
        data: {
          surgeryName: 'Cystotomy',
          surgeon: 'Dr. Mehta',
          duration: '2h',
          anesthesia: 'iso',
          findings: 'calculi removed',
          complications: 'nil',
          postOp: 'NSAIDs',
        },
        remarks: null,
      }),
    ).toEqual(['Anesthesia: iso', 'Findings: calculi removed', 'Complications: nil', 'Post-op: NSAIDs']);
  });

  it('FOOD — water always emitted; vomiting only when false', () => {
    expect(
      activityDetailLines({
        type: 'FOOD',
        data: { foodType: 'Kibble', qty: '120g', water: '350ml', intake: 'Fully', vomiting: false },
        remarks: null,
      }),
    ).toEqual(['Water: 350ml', 'Vomiting: no']);
    expect(
      activityDetailLines({
        type: 'FOOD',
        data: { foodType: 'Kibble', intake: 'Fully', vomiting: true },
        remarks: null,
      }),
    ).toEqual([]); // vomiting=true is already in headline, water absent
  });

  it('WALK — urinated + stool emitted as yes/no; duration/mobility/assisted skipped', () => {
    expect(
      activityDetailLines({
        type: 'WALK',
        data: { duration: '15min', mobility: 'Normal', urination: true, stool: false, assisted: false },
        remarks: null,
      }),
    ).toEqual(['Urinated: yes', 'Stool: no']);
  });

  it('BATH — bath type skipped; groomingBy + bath notes new', () => {
    expect(
      activityDetailLines({
        type: 'BATH',
        data: { bathType: 'Medicated bath', groomingBy: 'Sahil', remarks: 'skin improved' },
        remarks: 'follow up next week',
      }),
    ).toEqual(['Grooming by: Sahil', 'Bath notes: skin improved', 'Remarks: follow up next week']);
  });

  it('ADMISSION — only remarks (summary === data.summary)', () => {
    expect(
      activityDetailLines({
        type: 'ADMISSION',
        data: { summary: 'Brought in injured' },
        remarks: 'family notified',
      }),
    ).toEqual(['Remarks: family notified']);
  });
});
