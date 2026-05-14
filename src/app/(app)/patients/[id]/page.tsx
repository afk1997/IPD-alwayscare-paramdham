import { AnimalDetail } from '@/features/animals/components/AnimalDetail';

export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AnimalDetail animalId={id} />;
}
