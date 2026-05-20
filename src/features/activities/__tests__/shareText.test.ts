import type { ActivityType } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { formatActivityShareText } from '../shareText';

const baseAnimal = {
  animalName: 'Buddy',
  animalSpecies: 'Dog',
  animalWard: 'A1',
};

const occurredAt = new Date('2026-05-20T09:00:00Z'); // 14:30 IST

describe('formatActivityShareText', () => {
  it('formats a TREATMENT with meds, media, byName', () => {
    const out = formatActivityShareText({
      ...baseAnimal,
      type: 'TREATMENT' as ActivityType,
      occurredAt,
      data: { meds: [{ name: 'Meloxicam', dose: '1.5 mg', route: 'IV' }] },
      remarks: 'pain controlled',
      byName: 'Dr. Mehta',
      mediaCount: 1,
    });
    expect(out).toBe(
      [
        '🐶 *Buddy* (Dog · A1) · 20 May 2026',
        '*14:30  Treatment*  📎',
        'Meloxicam 1.5 mg IV',
        'Remarks: pain controlled',
        '— Dr. Mehta',
      ].join('\n'),
    );
  });

  it('omits 📎 when mediaCount is 0', () => {
    const out = formatActivityShareText({
      ...baseAnimal,
      type: 'TREATMENT' as ActivityType,
      occurredAt,
      data: { meds: [{ name: 'Meloxicam', dose: '1.5 mg', route: 'IV' }] },
      remarks: null,
      byName: 'Dr. Mehta',
      mediaCount: 0,
    });
    expect(out.split('\n')[1]).toBe('*14:30  Treatment*');
  });

  it('omits ward when null', () => {
    const out = formatActivityShareText({
      animalName: 'Buddy',
      animalSpecies: 'Dog',
      animalWard: null,
      type: 'TREATMENT' as ActivityType,
      occurredAt,
      data: { meds: [{ name: 'X', dose: '1', route: 'IV' }] },
      remarks: null,
      byName: 'Dr. Mehta',
      mediaCount: 0,
    });
    expect(out.split('\n')[0]).toBe('🐶 *Buddy* (Dog) · 20 May 2026');
  });

  it('falls back to 🐾 for unknown species', () => {
    const out = formatActivityShareText({
      animalName: 'Lucky',
      animalSpecies: 'Tortoise',
      animalWard: null,
      type: 'ROUND' as ActivityType,
      occurredAt,
      data: { temp: '38.5' },
      remarks: null,
      byName: 'Dr. Mehta',
      mediaCount: 0,
    });
    expect(out.startsWith('🐾 *Lucky*')).toBe(true);
  });

  it('drops the trailing — byName line when byName is empty', () => {
    const out = formatActivityShareText({
      ...baseAnimal,
      type: 'ROUND' as ActivityType,
      occurredAt,
      data: { temp: '38.5' },
      remarks: null,
      byName: '',
      mediaCount: 0,
    });
    expect(out.split('\n').some((l) => l.startsWith('— '))).toBe(false);
  });

  it('drops the summary line when summarizeActivity returns "—"', () => {
    const out = formatActivityShareText({
      ...baseAnimal,
      type: 'ROUND' as ActivityType,
      occurredAt,
      data: {},
      remarks: null,
      byName: 'Dr. Mehta',
      mediaCount: 0,
    });
    expect(out.split('\n')).toHaveLength(3);
  });

  it('emits all populated ROUND detail fields below the headline', () => {
    const out = formatActivityShareText({
      ...baseAnimal,
      type: 'ROUND' as ActivityType,
      occurredAt,
      data: {
        temp: '38.5',
        pain: '2/10',
        appetite: 'Good',
        hydration: 'OK',
      },
      remarks: null,
      byName: 'Dr. Mehta',
      mediaCount: 0,
    });
    const lines = out.split('\n');
    expect(lines).toContain('Appetite: Good');
    expect(lines).toContain('Hydration: OK');
  });

  it('formats SURGERY with anesthesia + findings', () => {
    const out = formatActivityShareText({
      ...baseAnimal,
      type: 'SURGERY' as ActivityType,
      occurredAt,
      data: {
        surgeryName: 'Spay',
        duration: '45 min',
        surgeon: 'Dr. Iyer',
        anesthesia: 'Iso',
        findings: 'unremarkable',
      },
      remarks: null,
      byName: 'Dr. Iyer',
      mediaCount: 0,
    });
    expect(out).toContain('*14:30  Surgery*');
    expect(out).toContain('Spay (45 min) — Dr. Iyer');
    expect(out).toContain('Anesthesia: Iso');
    expect(out).toContain('Findings: unremarkable');
  });

  it('formats FOOD with explicit Vomiting: no', () => {
    const out = formatActivityShareText({
      ...baseAnimal,
      type: 'FOOD' as ActivityType,
      occurredAt,
      data: { foodType: 'Chicken', intake: 'Fully', vomiting: false },
      remarks: null,
      byName: 'Dr. Mehta',
      mediaCount: 0,
    });
    expect(out).toContain('Chicken · Fully');
    expect(out).toContain('Vomiting: no');
  });

  it('formats BATH', () => {
    const out = formatActivityShareText({
      ...baseAnimal,
      type: 'BATH' as ActivityType,
      occurredAt,
      data: { bathType: 'Medicated', groomingBy: 'Asha' },
      remarks: null,
      byName: 'Asha',
      mediaCount: 0,
    });
    expect(out).toContain('*14:30  Bath & grooming*');
    expect(out).toContain('Medicated');
    expect(out).toContain('Grooming by: Asha');
  });

  it('formats WALK with urination + stool flags', () => {
    const out = formatActivityShareText({
      ...baseAnimal,
      type: 'WALK' as ActivityType,
      occurredAt,
      data: { duration: '15 min', urination: true, stool: false, assisted: false },
      remarks: null,
      byName: 'Asha',
      mediaCount: 0,
    });
    expect(out).toContain('Urinated: yes');
    expect(out).toContain('Stool: no');
  });

  it('formats DIAGNOSTIC with tests + interpretation', () => {
    const out = formatActivityShareText({
      ...baseAnimal,
      type: 'DIAGNOSTIC' as ActivityType,
      occurredAt,
      data: { tests: ['CBC', 'X-ray'], findings: 'hairline fracture', interpretation: 'rest 2 wks' },
      remarks: null,
      byName: 'Dr. Mehta',
      mediaCount: 2,
    });
    expect(out).toContain('CBC, X-ray — hairline fracture');
    expect(out).toContain('Interpretation: rest 2 wks');
    expect(out.split('\n')[1]).toBe('*14:30  Diagnostic*  📎');
  });

  it('formats ADMISSION', () => {
    const out = formatActivityShareText({
      ...baseAnimal,
      type: 'ADMISSION' as ActivityType,
      occurredAt,
      data: { summary: 'Hit by car, fractured rear leg' },
      remarks: null,
      byName: 'Dr. Mehta',
      mediaCount: 0,
    });
    expect(out).toContain('*14:30  Admission*');
    expect(out).toContain('Hit by car, fractured rear leg');
  });
});
