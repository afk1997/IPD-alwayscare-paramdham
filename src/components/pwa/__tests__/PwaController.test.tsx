import { ToastProvider } from '@/components/ui/Toast';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PwaController } from '../PwaController';

function stubServiceWorker(waiting: { postMessage: ReturnType<typeof vi.fn> }) {
  const reg = { waiting, installing: null, addEventListener: vi.fn() };
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      register: vi.fn().mockResolvedValue(reg),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      controller: {},
    },
  });
}

describe('PwaController', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    // @ts-expect-error cleanup test stub
    // biome-ignore lint/performance/noDelete: configurable stub must be deleted to reset navigator
    delete navigator.serviceWorker;
  });

  it('prompts to refresh when a worker is waiting and posts SKIP_WAITING', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const postMessage = vi.fn();
    stubServiceWorker({ postMessage });
    render(
      <ToastProvider>
        <PwaController />
      </ToastProvider>,
    );
    const refresh = await screen.findByRole('button', { name: 'Refresh' });
    await userEvent.click(refresh);
    expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });
});
