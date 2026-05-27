import { AdmissionWizard } from '@/features/animals/components/AdmissionWizard';
import { listAssignableCages } from '@/features/cages/queries';
import { requireWriteRole } from '@/lib/auth';

export default async function NewPatientPage() {
  await requireWriteRole();
  const cages = await listAssignableCages();
  return <AdmissionWizard cages={cages} />;
}
