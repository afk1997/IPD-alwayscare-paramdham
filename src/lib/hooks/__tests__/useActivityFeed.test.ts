import type { SerializedActivity } from '@/features/activities/serialized';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  dispatchActivityCreated,
  dispatchActivityRemoved,
  resetActivityFeedForTests,
  useActivityFeed,
} from '../useActivityFeed';

const fixture = (id: string, animalId = 'a1'): SerializedActivity => ({
  id,
  animalId,
  type: 'FOOD',
  occurredAt: '2026-05-28T10:00:00Z',
  byName: 'Tester',
  remarks: null,
  editedAt: null,
  data: { foodType: 'dry' },
  media: [],
});

afterEach(() => {
  resetActivityFeedForTests();
});

describe('useActivityFeed', () => {
  it('starts with no events', () => {
    const { result } = renderHook(() => useActivityFeed());
    expect(result.current.lastEvent).toBeNull();
  });

  it('delivers a created event to mounted subscribers', () => {
    const { result } = renderHook(() => useActivityFeed());
    act(() => dispatchActivityCreated(fixture('1')));
    expect(result.current.lastEvent).toEqual({
      kind: 'created',
      activity: expect.objectContaining({ id: '1' }),
    });
  });

  it('delivers a removed event with the row id', () => {
    const { result } = renderHook(() => useActivityFeed());
    act(() => dispatchActivityRemoved('xyz'));
    expect(result.current.lastEvent).toEqual({ kind: 'removed', id: 'xyz' });
  });

  it('two mounted hooks both receive the same event reference', () => {
    const a = renderHook(() => useActivityFeed());
    const b = renderHook(() => useActivityFeed());
    act(() => dispatchActivityCreated(fixture('2')));
    expect(a.result.current.lastEvent).toBe(b.result.current.lastEvent);
  });
});
