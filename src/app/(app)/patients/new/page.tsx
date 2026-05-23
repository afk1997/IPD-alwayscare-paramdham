import { AdmissionWizard } from '@/features/animals/components/AdmissionWizard';
import { requireWriteRole } from '@/lib/auth';

export default async function NewPatientPage() {
  await requireWriteRole();
  return <AdmissionWizard />;
}
