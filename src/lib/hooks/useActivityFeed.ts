'use client';
import type { SerializedActivity } from '@/features/activities/serialized';
import { useSyncExternalStore } from 'react';

/**
 * Module-level event bus for activity-feed cross-component updates.
 *
 * Producers: QuickAddModal (after creating an activity) and
 * ActivityQuickAdd (after inline create on the patient detail page).
 * Consumers: ActivityTimeline (per-animal feed) and TodayTimelineList
 * (cross-animal feed).
 *
 * Why a store instead of prop drilling: the QuickAdd flow lives in
 * AppShell, but mutating a row should reflect in the patient page's
 * ActivityTimeline if that page is mounted under the modal.  A store
 * is the simplest way to bridge without lifting state to the shell.
 *
 * Why useSyncExternalStore instead of context: avoids re-rendering
 * the whole subscriber tree when an unrelated event fires.  Consumers
 * subscribe per-render and read the latest event by reference.
 */

export type ActivityFeedEvent =
  | { kind: 'created'; activity: SerializedActivity }
  | { kind: 'removed'; id: string };

let currentEvent: ActivityFeedEvent | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ActivityFeedEvent | null {
  return currentEvent;
}

function getServerSnapshot(): ActivityFeedEvent | null {
  return null;
}

export function dispatchActivityCreated(activity: SerializedActivity): void {
  currentEvent = { kind: 'created', activity };
  for (const l of listeners) l();
}

export function dispatchActivityRemoved(id: string): void {
  currentEvent = { kind: 'removed', id };
  for (const l of listeners) l();
}

/** Test-only: clear the singleton state between cases. */
export function resetActivityFeedForTests(): void {
  currentEvent = null;
  listeners.clear();
}

export function useActivityFeed(): { lastEvent: ActivityFeedEvent | null } {
  const lastEvent = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { lastEvent };
}
