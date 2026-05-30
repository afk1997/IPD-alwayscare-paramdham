import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ActivityFilter } from '../../filter';
import { ActivityDateFilter } from '../ActivityDateFilter';

function setup(value: ActivityFilter = { kind: 'all' }) {
  const onChange = vi.fn();
  render(<ActivityDateFilter value={value} onChange={onChange} minDate="2026-05-01" maxDate="2026-05-15" />);
  return { onChange };
}

describe('ActivityDateFilter', () => {
  it('renders the preset chips and custom-range chip', () => {
    setup();
    for (const name of ['All', 'Today', 'Last 3 days', 'Last 7 days', 'Custom range']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('emits a preset filter when a chip is clicked', async () => {
    const { onChange } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Last 3 days' }));
    expect(onChange).toHaveBeenCalledWith({ kind: 'preset', days: 3 });
  });

  it('emits all when All is clicked', async () => {
    const { onChange } = setup({ kind: 'preset', days: 7 });
    await userEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(onChange).toHaveBeenCalledWith({ kind: 'all' });
  });

  it('opens the popover and emits a custom range on Apply', async () => {
    const { onChange } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Custom range' }));
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-05-10' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-05-12' } });
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onChange).toHaveBeenCalledWith({ kind: 'custom', from: '2026-05-10', to: '2026-05-12' });
  });

  it('swaps from/to when entered in reverse', async () => {
    const { onChange } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Custom range' }));
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-05-12' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-05-10' } });
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onChange).toHaveBeenCalledWith({ kind: 'custom', from: '2026-05-10', to: '2026-05-12' });
  });

  it('labels the custom chip with the active range', () => {
    setup({ kind: 'custom', from: '2026-05-09', to: '2026-05-12' });
    expect(screen.getByRole('button', { name: '9 May – 12 May' })).toBeInTheDocument();
  });
});
