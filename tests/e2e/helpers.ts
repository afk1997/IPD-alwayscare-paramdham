import type { Page } from '@playwright/test';

// TST-11: single source of truth for e2e creds. Override via env when
// running against a non-seeded environment.
export const E2E_ADMIN = {
  email: process.env.E2E_EMAIL ?? 'admin@arham.care',
  password: process.env.E2E_PASSWORD ?? 'admin1234',
};

export async function login(page: Page, email = E2E_ADMIN.email, password = E2E_ADMIN.password) {
  // The suite runs against `next dev`, whose dev-tools badge (<nextjs-portal>)
  // floats above the UI and can intercept clicks (e.g. the activity sheet's
  // Edit button). Hide it in every document this page loads.
  await page.addInitScript(() => {
    const hide = () => {
      const style = document.createElement('style');
      style.textContent = 'nextjs-portal { display: none !important; }';
      document.head.appendChild(style);
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', hide);
    } else {
      hide();
    }
  });
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  // 60s — first Next compile on a cold CI runner can be 20-30s on top
  // of the auth round-trip.
  await page.waitForURL('/', { timeout: 60_000 });
}
