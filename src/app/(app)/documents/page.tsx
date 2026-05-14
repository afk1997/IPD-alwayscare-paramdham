import { EmptyState } from '@/components/ui/EmptyState';
import { listAllDocuments } from '@/features/documents/queries';
import { DOC_CATEGORY_LABELS } from '@/features/documents/schema';
import { relativeTime } from '@/lib/time';
import { FileText } from 'lucide-react';
import Link from 'next/link';

export default async function DocumentsPage() {
  const documents = await listAllDocuments(100);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Documents</h1>
        <p className="mt-1 text-sm text-muted">All uploaded documents across patients</p>
      </div>
      {documents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents yet"
          description="Documents you upload on patient pages will show here."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {documents.map((d) => (
            <li key={d.id}>
              <Link
                href={`/patients/${d.animal.id}`}
                className="flex items-center gap-3 rounded-lg border border-line bg-paper p-3 hover:bg-paper-2"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent-soft text-accent-ink">
                  <FileText size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-medium">{d.kind}</span>
                    <span className="text-xs text-muted">
                      · {d.animal.name} ({d.animal.species})
                    </span>
                  </div>
                  <div className="truncate text-xs text-muted">
                    {DOC_CATEGORY_LABELS[d.category]} · {d.uploadedBy.name} · {relativeTime(d.createdAt)}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
