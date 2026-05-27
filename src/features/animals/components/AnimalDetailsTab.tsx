'use client';
import { Button } from '@/components/ui/Button';
import { formatDateTime } from '@/lib/time';
import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { AnimalEditForm } from './AnimalEditForm';

interface Animal {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  gender: string | null;
  ageText: string | null;
  color: string | null;
  weightKg: string | null;
  vaccination: string;
  sterilized: boolean;
  aggressive: boolean;
  contagious: boolean;
  ward: string | null;
  cage: string | null;
  cageId: string | null;
  status: string;
  admittedAt: string;
  complaint: string | null;
  history: string | null;
  injuryType: string | null;
  diagnosis: string | null;
  immediateTreatment: string | null;
  surgeryRequired: string | null;
  rescuer: string | null;
  rescuerPhone: string | null;
  address: string | null;
  ngo: string | null;
  broughtBy: string | null;
  testsAdvised: string[];
}

interface Props {
  animal: Animal;
  cages: { id: string; name: string }[];
}

const TEST_LABELS: Record<string, string> = {
  XRAY: 'X-ray',
  USG: 'USG',
  BLOOD_TEST: 'Blood test',
  MRI: 'MRI',
  CT_SCAN: 'CT scan',
  SONOGRAPHY: 'Sonography',
};

export function AnimalDetailsTab({ animal, cages }: Props) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="rounded-lg border border-line bg-paper p-5">
        <AnimalEditForm
          cages={cages}
          animal={{
            id: animal.id,
            name: animal.name,
            breed: animal.breed,
            ageText: animal.ageText,
            color: animal.color,
            weightKg: animal.weightKg,
            vaccination: animal.vaccination,
            sterilized: animal.sterilized,
            aggressive: animal.aggressive,
            contagious: animal.contagious,
            ward: animal.ward,
            cageId: animal.cageId,
            status: animal.status,
            complaint: animal.complaint,
            history: animal.history,
            injuryType: animal.injuryType,
            diagnosis: animal.diagnosis,
            immediateTreatment: animal.immediateTreatment,
            surgeryRequired: animal.surgeryRequired,
            rescuer: animal.rescuer,
            rescuerPhone: animal.rescuerPhone,
            address: animal.address,
            ngo: animal.ngo,
            broughtBy: animal.broughtBy,
          }}
          onDone={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
          <Pencil size={14} /> Edit details
        </Button>
      </div>

      <DetailSection title="Details">
        <DetailGrid>
          <Field label="Ward" value={animal.ward} />
          <Field label="Cage" value={animal.cage} />
          <Field label="Admitted at" value={formatDateTime(animal.admittedAt)} />
          <Field label="Color" value={animal.color} />
          <Field label="Vaccination" value={animal.vaccination} />
          <Field label="Sterilized" value={animal.sterilized ? 'Yes' : 'No'} />
          <Field label="Aggressive" value={animal.aggressive ? 'Yes' : 'No'} />
          <Field label="Contagious" value={animal.contagious ? 'Yes' : 'No'} />
          <Field label="Surgery req'd" value={animal.surgeryRequired} />
        </DetailGrid>
      </DetailSection>

      <DetailSection title="Rescue / Owner">
        <DetailGrid>
          <Field label="Rescuer" value={animal.rescuer} />
          <Field label="Contact" value={animal.rescuerPhone} />
          <Field label="NGO" value={animal.ngo} />
          <Field label="Brought by" value={animal.broughtBy} />
        </DetailGrid>
        {animal.address && (
          <p className="mt-3 text-sm text-text">
            <span className="text-muted">Address: </span>
            {animal.address}
          </p>
        )}
      </DetailSection>

      <DetailSection title="Medical">
        <Field label="Chief complaint" value={animal.complaint} block />
        <Field label="History" value={animal.history} block />
        <Field label="Injury type" value={animal.injuryType} />
        <Field label="Tentative diagnosis" value={animal.diagnosis} block />
        <Field label="Immediate treatment" value={animal.immediateTreatment} block />
        {animal.testsAdvised.length > 0 && (
          <div className="mt-2">
            <div className="text-muted text-xs">Tests advised</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {animal.testsAdvised.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-accent-soft px-2.5 py-1 font-medium text-accent-ink text-xs"
                >
                  {TEST_LABELS[t] ?? t}
                </span>
              ))}
            </div>
          </div>
        )}
      </DetailSection>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-paper p-5">
      <header className="mb-4 flex items-center gap-2">
        <h2 className="font-display font-bold text-base">{title}</h2>
      </header>
      <div>{children}</div>
    </section>
  );
}

function DetailGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{children}</div>;
}

function Field({
  label,
  value,
  block = false,
}: {
  label: string;
  value: string | number | null | undefined;
  block?: boolean;
}) {
  if (!value) return null;
  return (
    <div className={block ? 'col-span-full' : ''}>
      <div className="text-muted text-xs">{label}</div>
      <div className="mt-0.5 text-sm text-text">{value}</div>
    </div>
  );
}
