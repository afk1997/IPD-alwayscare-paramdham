'use client';
import { useRouter } from 'next/navigation';
import { LifecycleForm, type LifecycleVariant } from './LifecycleForm';

interface Props {
  animalId: string;
  variant: LifecycleVariant;
}

export function LifecyclePageForm({ animalId, variant }: Props) {
  const router = useRouter();
  const onDone = () => router.push(`/patients/${animalId}`);
  return <LifecycleForm animalId={animalId} onDone={onDone} initialVariant={variant} />;
}
