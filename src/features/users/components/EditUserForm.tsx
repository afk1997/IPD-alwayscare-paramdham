'use client';
import { FormField, FormSection } from '@/components/forms/FormField';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { deactivateUserAction, updateUserAction } from '../actions';
import { ROLES, ROLE_LABELS, type Role } from '../schema';

interface Props {
  user: { id: string; name: string; email: string; role: Role; active: boolean };
}

export function EditUserForm({ user }: Props) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState<Role>(user.role);
  const [password, setPassword] = useState('');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const save = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const result = await updateUserAction({
        id: user.id,
        name,
        role,
        ...(password ? { password } : {}),
      });
      if (!result.ok) setError(result.error ?? 'Update failed');
      else router.push('/admin/users');
    });
  };

  const disable = () => {
    setError(null);
    start(async () => {
      const result = await deactivateUserAction(user.id);
      if (!result.ok) setError(result.error ?? 'Deactivate failed');
      else router.push('/admin/users');
    });
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-5">
      <FormSection title={`Edit ${user.name}`} description={user.email}>
        <FormField label="Full name" required>
          {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}
        </FormField>
        <FormField label="Role" required>
          {(id) => (
            <Select id={id} value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField
          label="Reset password"
          hint="Leave blank to keep the current password. At least 6 characters to change it."
        >
          {(id) => (
            <Input
              id={id}
              type="text"
              autoComplete="new-password"
              placeholder="New temporary password (optional)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </FormField>
      </FormSection>
      {error && (
        <div role="alert" className="text-sm text-critical">
          {error}
        </div>
      )}
      <div className="flex justify-between">
        {user.active && (
          <Button type="button" variant="danger" onClick={disable} disabled={pending}>
            Disable user
          </Button>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
