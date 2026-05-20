import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    activity: {
      findMany: vi.fn(async () => []),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import { listActivitiesOnDateForAnimal } from '../queries';

const findMany = vi.mocked(prisma.activity.findMany);

beforeEach(() => {
  findMany.mockClear();
});

describe('listActivitiesOnDateForAnimal', () => {
  it('filters by animalId AND the date range', async () => {
    await listActivitiesOnDateForAnimal(new Date('2026-05-20T00:00:00Z'), 'cabc123');
    expect(findMany).toHaveBeenCalledOnce();
    const arg = findMany.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    expect(arg.where).toMatchObject({
      animalId: 'cabc123',
      deletedAt: null,
    });
    expect(arg.where.occurredAt).toBeDefined();
  });

  it('returns an empty array when no rows match', async () => {
    const out = await listActivitiesOnDateForAnimal(new Date('2026-05-20T00:00:00Z'), 'cnone');
    expect(out).toEqual([]);
  });
});
