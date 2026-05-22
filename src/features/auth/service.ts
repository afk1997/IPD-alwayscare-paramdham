import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 12;

// Pre-computed bcrypt hash of a constant string — used as a dummy compare
// when the email is unknown, so the response time matches a real
// password-check path (AUTH-7 email-enumeration via timing).
const DUMMY_HASH = '$2a$12$abcdefghijklmnopqrstuuRKqRvqRvqRvqRvqRvqRvqRvqRvqRvqRq';

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

const WINDOW_MS = 15 * 60 * 1000;
const PER_EMAIL_LIMIT = 5;

async function isRateLimited(email: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS);
  const recent = await prisma.auditLog.count({
    where: {
      action: 'login',
      entityType: 'User',
      createdAt: { gte: since },
      context: { path: ['email'], equals: email.toLowerCase() } as never,
      actorId: null,
    },
  });
  return recent >= PER_EMAIL_LIMIT;
}

async function recordFailedAttempt(email: string): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: null,
      action: 'login',
      entityType: 'User',
      entityId: 'unknown',
      context: { email: email.toLowerCase(), result: 'failed' } as never,
    },
  });
}

export async function verifyCredentials(email: string, password: string): Promise<AuthenticatedUser | null> {
  const normalized = email.toLowerCase();
  if (await isRateLimited(normalized)) {
    await bcrypt.compare(password, DUMMY_HASH);
    return null;
  }

  const user = await findUserByEmail(normalized);

  if (!user || !user.active) {
    await bcrypt.compare(password, DUMMY_HASH);
    await recordFailedAttempt(normalized);
    return null;
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    await recordFailedAttempt(normalized);
    return null;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}
