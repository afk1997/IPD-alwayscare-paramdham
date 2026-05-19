'use client';
import { useRouter } from 'next/navigation';
import { DeathForm } from './DeathForm';
import { DischargeForm } from './DischargeForm';

interface Props {
  animalId: string;
  variant: 'discharge' | 'death';
}

export function LifecyclePageForm({ animalId, variant }: Props) {
  const router = useRouter();
  const onDone = () => router.push(`/patients/${animalId}`);
  return variant === 'discharge' ? (
    <DischargeForm animalId={animalId} onDone={onDone} />
  ) : (
    <DeathForm animalId={animalId} onDone={onDone} />
  );
}
