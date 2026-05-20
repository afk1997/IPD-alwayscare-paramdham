import { describe, expect, it } from 'vitest';
import { formatDailyReportText } from '../dailyReportText';
import type { ActivityRow } from '../queries';

function row(over: Partial<ActivityRow>): ActivityRow {
  return {
    id: 't1',
    animalId: 'a1',
    animalName: 'Bruno',
    animalSpecies: 'Dog',
    animalWard: null,
    type: 'TREATMENT',
    occurredAt: new Date('2026-05-20T09:30:00+05:30'),
    byName: 'Dr. Mehta',
    summary: 'Amoxiclav 20mg/kg Oral',
    mediaCount: 0,
    ...over,
  };
}

describe('formatDailyReportText', () => {
  it('returns header + "0 entries" when rows is empty', () => {
    const out = formatDailyReportText('2026-05-20', []);
    expect(out).toBe('🏥 Arham Always Care — Wed, 20 May 2026\n0 entries');
  });

  it('groups rows under a single animal block sorted by time', () => {
    const rows: ActivityRow[] = [
      row({
        id: 'a',
        occurredAt: new Date('2026-05-20T12:30:00+05:30'),
        type: 'FOOD',
        summary: 'Kibble · Fully',
        byName: 'Nurse Pooja',
      }),
      row({
        id: 'b',
        occurredAt: new Date('2026-05-20T09:15:00+05:30'),
        type: 'ROUND',
        summary: 'Stable',
        byName: 'Dr. Mehta',
      }),
      row({
        id: 'c',
        occurredAt: new Date('2026-05-20T09:30:00+05:30'),
        type: 'TREATMENT',
        summary: 'Amoxiclav 20mg/kg Oral',
        byName: 'Dr. Mehta',
      }),
    ];
    const out = formatDailyReportText('2026-05-20', rows);
    expect(out).toBe(
      [
        '🏥 Arham Always Care — Wed, 20 May 2026',
        '3 entries',
        '',
        '🐶 Bruno (Dog)',
        '• 09:15  Doctor round — Stable  (Dr. Mehta)',
        '• 09:30  Treatment — Amoxiclav 20mg/kg Oral  (Dr. Mehta)',
        '• 12:30  Food & water — Kibble · Fully  (Nurse Pooja)',
      ].join('\n'),
    );
  });

  it('sorts animal groups alphabetically (case-insensitive) and includes ward', () => {
    const rows: ActivityRow[] = [
      row({
        id: 'a',
        animalId: 'milo',
        animalName: 'Milo',
        animalSpecies: 'Cat',
        animalWard: 'ISO-A',
        occurredAt: new Date('2026-05-20T09:00:00+05:30'),
        type: 'ROUND',
        summary: 'Improving',
        byName: 'Dr. Iyer',
      }),
      row({
        id: 'b',
        animalId: 'bruno',
        animalName: 'bruno', // lowercase to test case-insensitive sort
        animalSpecies: 'Dog',
        animalWard: 'Surgery-1',
        occurredAt: new Date('2026-05-20T09:15:00+05:30'),
        type: 'ROUND',
        summary: 'Stable',
        byName: 'Dr. Mehta',
      }),
    ];
    const out = formatDailyReportText('2026-05-20', rows);
    expect(out).toBe(
      [
        '🏥 Arham Always Care — Wed, 20 May 2026',
        '2 entries',
        '',
        '🐶 bruno (Dog · Surgery-1)',
        '• 09:15  Doctor round — Stable  (Dr. Mehta)',
        '',
        '🐱 Milo (Cat · ISO-A)',
        '• 09:00  Doctor round — Improving  (Dr. Iyer)',
      ].join('\n'),
    );
  });

  it('appends 📎 to rows with mediaCount > 0 and falls back to 🐾 for unknown species', () => {
    const rows: ActivityRow[] = [
      row({
        animalSpecies: 'Goldfish', // not in the emoji map
        type: 'BATH',
        summary: 'Medicated bath',
        mediaCount: 2,
      }),
    ];
    const out = formatDailyReportText('2026-05-20', rows);
    expect(out).toContain('🐾 Bruno (Goldfish)');
    expect(out).toMatch(/Medicated bath {2}\(Dr\. Mehta\) {2}📎$/);
  });
});
