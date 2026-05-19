import type { LightboxItem } from '@/components/media/Lightbox';
import { MediaGrid } from '@/components/media/MediaGrid';

interface AssetRef {
  id: string;
  kind: 'PHOTO' | 'VIDEO' | 'XRAY' | 'DOC';
  filename: string;
  label?: string | null;
}

interface Props {
  items: AssetRef[];
}

export function VisualRecords({ items }: Props) {
  // Show photos / x-rays / videos in the grid.  Docs (PDFs etc.) belong in
  // the categorised document list further down the tab.
  const visual = items.filter((i) => i.kind !== 'DOC') as LightboxItem[];
  if (visual.length === 0) {
    return null;
  }
  return (
    <section className="rounded-lg border border-line bg-paper p-5">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="font-bold text-[10.5px] text-muted uppercase tracking-[0.07em]">
          Visual records · {visual.length}
        </h2>
      </header>
      <MediaGrid items={visual} />
    </section>
  );
}
