import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  // No min-length on login — the password floor is enforced at
  // create/reset time (users/schema.ts PasswordSchema). The login form
  // should accept whatever string the user actually has; if it's
  // wrong, the bcrypt compare returns false and we surface "invalid
  // credentials" rather than a confusing client-side length error.
  password: z.string().min(1, 'Required'),
});

export type LoginInput = z.infer<typeof LoginSchema>;
