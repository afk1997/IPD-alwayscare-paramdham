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
      // 16px on mobile prevents iOS Safari auto-zoom on focus.
      className={`w-full rounded-md border bg-paper px-3 py-2 text-base outline-none transition focus:border-accent md:text-sm ${
        invalid ? 'border-critical' : 'border-line'
      } ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
});
