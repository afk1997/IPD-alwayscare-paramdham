import { LifecyclePageForm } from '@/features/animals/lifecycle/components/RedirectAfterDone';
import { getAnimal } from '@/features/animals/queries';
import { requireWriteRole } from '@/lib/auth';
import { notFound } from 'next/navigation';

export default async function DeathPage({ params }: { params: Promise<{ id: string }> }) {
  await requireWriteRole();
  const { id } = await params;
  const animal = await getAnimal(id);
  if (!animal) notFound();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold tracking-tight">Record death — {animal.name}</h1>
      <LifecyclePageForm animalId={id} variant="death" />
    </div>
  );
}
