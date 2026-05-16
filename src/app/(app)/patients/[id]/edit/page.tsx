import { AnimalEditForm } from '@/features/animals/components/AnimalEditForm';
import { getAnimal } from '@/features/animals/queries';
import { notFound } from 'next/navigation';

export default async function EditAnimalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const animal = await getAnimal(id);
  if (!animal) notFound();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold tracking-tight">Edit {animal.name}</h1>
      <AnimalEditForm
        animal={{
          id: animal.id,
          name: animal.name,
          breed: animal.breed,
          ageText: animal.ageText,
          color: animal.color,
          weightKg: animal.weightKg ? String(animal.weightKg) : null,
          vaccination: animal.vaccination,
          sterilized: animal.sterilized,
          aggressive: animal.aggressive,
          contagious: animal.contagious,
          ward: animal.ward,
          status: animal.status,
          complaint: animal.complaint,
          history: animal.history,
          injuryType: animal.injuryType,
          diagnosis: animal.diagnosis,
          surgeryRequired: animal.surgeryRequired,
          rescuer: animal.rescuer,
          rescuerPhone: animal.rescuerPhone,
          address: animal.address,
          ngo: animal.ngo,
          broughtBy: animal.broughtBy,
        }}
      />
    </div>
  );
}
