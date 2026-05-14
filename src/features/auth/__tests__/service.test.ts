import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../service';

describe('password hashing', () => {
  it('hashPassword produces a non-empty hash different from the input', async () => {
    const hash = await hashPassword('s3cret_PA55!');
    expect(hash.length).toBeGreaterThan(20);
    expect(hash).not.toBe('s3cret_PA55!');
  });

  it('verifyPassword returns true for correct password', async () => {
    const hash = await hashPassword('s3cret_PA55!');
    await expect(verifyPassword('s3cret_PA55!', hash)).resolves.toBe(true);
  });

  it('verifyPassword returns false for wrong password', async () => {
    const hash = await hashPassword('s3cret_PA55!');
    await expect(verifyPassword('wrong', hash)).resolves.toBe(false);
  });
});
