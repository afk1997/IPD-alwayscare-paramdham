'use client';
import { Select } from '@/components/ui/Select';
import { type SelectHTMLAttributes, forwardRef } from 'react';

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  options: { id: string; name: string }[];
}

// Presentational only — spreads its props onto <Select> so it works both with
// react-hook-form's register() (admission) and as a controlled value/onChange
// input (edit form).
export const CageSelect = forwardRef<HTMLSelectElement, Props>(function CageSelect(
  { options, ...rest },
  ref,
) {
  return (
    <Select ref={ref} {...rest}>
      <option value="">Unassigned</option>
      {options.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </Select>
  );
});
