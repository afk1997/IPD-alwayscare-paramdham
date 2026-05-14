import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email: email.toLowerCase() } });
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export async function verifyCredentials(email: string, password: string): Promise<AuthenticatedUser | null> {
  const user = await findUserByEmail(email);
  if (!user || !user.active) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}
