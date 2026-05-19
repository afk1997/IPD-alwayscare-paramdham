import { type InputHTMLAttributes, forwardRef } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { invalid = false, className = '', ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      // Mobile uses text-base (16px) so iOS Safari doesn't auto-zoom on
      // focus; desktop drops back to the 14px design size.
      className={`w-full rounded-md border bg-paper px-3 py-2 text-base outline-none transition focus:border-accent md:text-sm ${
        invalid ? 'border-critical' : 'border-line'
      } ${className}`}
      {...rest}
    />
  );
});
