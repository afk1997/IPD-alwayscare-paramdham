import { type SelectHTMLAttributes, forwardRef } from 'react';

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { invalid = false, className = '', children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      className={`w-full rounded-md border bg-paper px-3 py-2 text-sm outline-none transition focus:border-accent ${
        invalid ? 'border-critical' : 'border-line'
      } ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
});
