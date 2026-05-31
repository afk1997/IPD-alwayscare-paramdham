import { describe, expect, it } from 'vitest';
import manifest from '../manifest';

describe('web manifest', () => {
  it('is installable: standalone, scoped, themed, with 192/512 + maskable icons', () => {
    const m = manifest();
    expect(m.display).toBe('standalone');
    expect(m.start_url).toBe('/');
    expect(m.scope).toBe('/');
    expect(m.theme_color).toBe('#0E7C7B');
    expect(m.name).toMatch(/Arham/);
    expect(m.short_name).toBeTruthy();
    const sizes = (m.icons ?? []).map((i) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    expect((m.icons ?? []).some((i) => i.purpose === 'maskable')).toBe(true);
  });
});
