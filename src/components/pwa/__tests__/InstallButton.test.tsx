import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InstallButton } from '../InstallButton';

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
});

describe('InstallButton', () => {
  it('shows Install after beforeinstallprompt and calls prompt() on click', async () => {
    render(<InstallButton />);
    expect(screen.queryByRole('button', { name: 'Install' })).toBeNull();

    const prompt = vi.fn().mockResolvedValue(undefined);
    const ev = Object.assign(new Event('beforeinstallprompt'), {
      prompt,
      preventDefault: vi.fn(),
    });
    await act(async () => {
      window.dispatchEvent(ev);
    });

    const btn = await screen.findByRole('button', { name: 'Install' });
    await userEvent.click(btn);
    expect(prompt).toHaveBeenCalledOnce();
  });
});
