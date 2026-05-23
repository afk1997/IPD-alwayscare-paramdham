'use client';
import { FormField, FormSection } from '@/components/forms/FormField';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { inviteUserAction } from '../actions';
import { ROLES, ROLE_LABELS, type Role } from '../schema';

interface Props {
  currentUserRole: Role;
}

// ADMIN sees STAFF/DOCTOR/ADMIN. SUPER_ADMIN sees all five. Server-side
// guards in users/service.ts are the real enforcement — this is UI
// consistency so ADMIN doesn't pick a role they can't grant.
const ADMIN_ASSIGNABLE: readonly Role[] = ['STAFF', 'DOCTOR', 'ADMIN'];

export function InviteUserForm({ currentUserRole }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const assignableRoles: readonly Role[] = currentUserRole === 'SUPER_ADMIN' ? ROLES : ADMIN_ASSIGNABLE;
  const [role, setRole] = useState<Role>('STAFF');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const result = await inviteUserAction({ email, name, role, temporaryPassword });
      if (!result.ok) setError(result.error ?? 'Invite failed');
      else router.push('/admin/users');
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <FormSection title="Invite user" description="Send this user a temporary password to log in with">
        <FormField label="Full name" required>
          {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}
        </FormField>
        <FormField label="Email" required>
          {(id) => <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
        </FormField>
        <FormField label="Role" required>
          {(id) => (
            <Select id={id} value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {assignableRoles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField
          label="Temporary password"
          hint="At least 12 characters with a mix of letters, numbers, and symbols. Share securely with the user."
          required
        >
          {(id) => (
            <Input
              id={id}
              type="text"
              value={temporaryPassword}
              onChange={(e) => setTemporaryPassword(e.target.value)}
            />
          )}
        </FormField>
      </FormSection>
      {error && (
        <div role="alert" className="text-sm text-critical">
          {error}
        </div>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? 'Creating…' : 'Create user'}
        </Button>
      </div>
    </form>
  );
}
