import { EmptyState } from '@/components/ui/EmptyState';
import { DocumentsFilters } from '@/features/documents/components/DocumentsFilters';
import { listAllDocuments } from '@/features/documents/queries';
import { DOC_CATEGORIES, DOC_CATEGORY_LABELS, type DocCategory } from '@/features/documents/schema';
import { requireAdminRole } from '@/lib/auth';
import { relativeTime } from '@/lib/time';
import { FileText } from 'lucide-react';
import Link from 'next/link';

const CATEGORY_SET = new Set<DocCategory>(DOC_CATEGORIES);

function asCategory(v: string | undefined): DocCategory | undefined {
  if (!v) return undefined;
  return CATEGORY_SET.has(v as DocCategory) ? (v as DocCategory) : undefined;
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const user = await requireAdminRole();

  const params = await searchParams;
  const search = params.q || undefined;
  const category = asCategory(params.category);
  const hasFilters = Boolean(search || category);

  const documents = await listAllDocuments(
    { id: user.id, role: user.role },
    {
      ...(search ? { search } : {}),
      ...(category ? { category } : {}),
    },
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display font-bold text-2xl tracking-tight">Documents</h1>
        <p className="mt-1 text-muted text-sm">
          {documents.length} {documents.length === 1 ? 'file' : 'files'}
          {hasFilters ? ' matching filters' : ' across patients'}
        </p>
      </div>

      <DocumentsFilters initialSearch={search ?? ''} initialCategory={category ?? 'ALL'} />

      {documents.length === 0 ? (
        hasFilters ? (
          <p className="px-1 py-2 text-muted text-sm">No documents match these filters.</p>
        ) : (
          <EmptyState
            icon={FileText}
            title="No documents yet"
            description="Documents you upload on patient pages will show here."
          />
        )
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
                    <span className="text-muted text-xs">
                      · {d.animal.name} ({d.animal.species})
                    </span>
                  </div>
                  <div className="truncate text-muted text-xs">
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
