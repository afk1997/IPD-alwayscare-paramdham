'use server';
import { signIn } from '@/lib/auth';
import { AuthError } from 'next-auth';
import { LoginSchema } from './schema';

export interface LoginActionResult {
  ok: boolean;
  error?: string;
}

export async function loginAction(formData: FormData): Promise<LoginActionResult> {
  const parsed = LoginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  try {
    await signIn('credentials', { ...parsed.data, redirect: false });
    return { ok: true };
  } catch (e) {
    if (e instanceof AuthError) {
      return { ok: false, error: 'Invalid email or password' };
    }
    throw e;
  }
}
