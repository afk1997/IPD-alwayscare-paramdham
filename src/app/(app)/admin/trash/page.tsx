import { TrashTabs } from '@/features/trash/components/TrashTabs';
import {
  listTrashActivities,
  listTrashAnimals,
  listTrashDocuments,
  trashCounts,
} from '@/features/trash/queries';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';

const TABS = ['activities', 'documents', 'animals'] as const;
type Tab = (typeof TABS)[number];

function asTab(v: string | undefined): Tab {
  return v && (TABS as readonly string[]).includes(v) ? (v as Tab) : 'activities';
}

export default async function TrashPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'ADMIN') redirect('/');

  const actor = { id: user.id, role: user.role };
  const params = await searchParams;
  const initialTab = asTab(params.tab);

  const [counts, activities, documents, animals] = await Promise.all([
    trashCounts(actor),
    listTrashActivities(actor, { take: 50 }),
    listTrashDocuments(actor, { take: 50 }),
    listTrashAnimals(actor, { take: 50 }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display font-bold text-2xl tracking-tight">Trash</h1>
        <p className="mt-1 text-muted text-sm">
          Restore deleted activities, documents, or patients. Restoring an animal also restores its activities
          and documents.
        </p>
      </div>
      <TrashTabs
        initialTab={initialTab}
        counts={counts}
        activities={activities}
        documents={documents}
        animals={animals}
      />
    </div>
  );
}
