import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';

export const THEMES = ['clinical', 'warm', 'utility'] as const;
export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = 'clinical';
export const THEME_COOKIE = 'arham_theme';

export function getThemeFromCookie(cookies: ReadonlyRequestCookies): Theme {
  const value = cookies.get(THEME_COOKIE)?.value;
  return THEMES.includes(value as Theme) ? (value as Theme) : DEFAULT_THEME;
}
