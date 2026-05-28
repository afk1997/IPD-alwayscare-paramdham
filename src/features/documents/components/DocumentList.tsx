import { EmptyState } from '@/components/ui/EmptyState';
import { relativeTime } from '@/lib/time';
import type { Document, MediaAsset } from '@prisma/client';
import { FileText } from 'lucide-react';
import Link from 'next/link';
import { DOC_CATEGORIES, DOC_CATEGORY_LABELS, type DocCategory } from '../schema';

type DocWithFile = Document & {
  file: MediaAsset | null;
  uploadedBy: { name: string };
  /** Pre-signed URL for the file asset, minted server-side. Null when file is null. */
  fileUrl: string | null;
};

interface Props {
  documents: DocWithFile[];
}

export function DocumentList({ documents }: Props) {
  if (documents.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No documents yet"
        description="Upload prescriptions, reports, consents, ownership and other paperwork here."
      />
    );
  }

  const byCategory = new Map<DocCategory, DocWithFile[]>();
  for (const cat of DOC_CATEGORIES) byCategory.set(cat, []);
  for (const d of documents) byCategory.get(d.category)?.push(d);

  return (
    <div className="flex flex-col gap-6">
      {Array.from(byCategory.entries()).map(([cat, docs]) => {
        if (docs.length === 0) return null;
        return (
          <section key={cat}>
            <h3 className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-soft">
              {DOC_CATEGORY_LABELS[cat]} · {docs.length}
            </h3>
            <ul className="flex flex-col gap-2">
              {docs.map((d) => (
                <li key={d.id}>
                  <Link
                    href={d.fileUrl ?? '#'}
                    target="_blank"
                    rel="noopener"
                    className="flex items-center gap-3 rounded-lg border border-line bg-paper p-3 transition hover:bg-paper-2"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent-soft text-accent-ink">
                      <FileText size={15} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{d.kind}</div>
                      <div className="truncate text-xs text-muted">
                        {d.name} · {d.uploadedBy.name} · {relativeTime(d.createdAt)}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
