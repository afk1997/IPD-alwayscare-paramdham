'use server';
import { THEMES, THEME_COOKIE, type Theme } from '@/lib/theme';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

export async function setThemeAction(theme: Theme): Promise<void> {
  if (!THEMES.includes(theme)) throw new Error('Invalid theme');
  const c = await cookies();
  c.set(THEME_COOKIE, theme, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    httpOnly: false,
  });
  revalidatePath('/', 'layout');
}
