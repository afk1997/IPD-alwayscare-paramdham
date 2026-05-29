import { Activity as ActivityIcon } from 'lucide-react';
import { listTodayActivities } from '../queries';
import { TodayTimelineList } from './TodayTimelineList';

export async function TodayTimeline({ type }: { type?: string } = {}) {
  const items = await listTodayActivities(type);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-line border-dashed bg-paper py-10 text-center">
        <ActivityIcon size={22} className="text-soft" />
        <p className="font-medium text-[13px] text-muted">Nothing logged yet today.</p>
        <p className="text-[12px] text-soft">
          Treatments, rounds, food, baths, walks — tap "+ New entry" or press N to log the first one.
        </p>
      </div>
    );
  }

  // Serialize for the client boundary — Date instances cross as-is, but the
  // payload is large and benefits from being shipped pre-shaped.
  const serialized = items.map((it) => ({
    id: it.id,
    animalId: it.animalId,
    animalName: it.animalName,
    animalSpecies: it.animalSpecies,
    animalThumbnailUrl: it.animalThumbnailUrl,
    type: it.type,
    occurredAt: it.occurredAt.toISOString(),
    byName: it.byName,
    remarks: it.remarks,
    data: it.data,
    editedAt: it.editedAt ? it.editedAt.toISOString() : null,
    media: it.media,
    summary: it.summary,
  }));

  return <TodayTimelineList items={serialized} />;
}
