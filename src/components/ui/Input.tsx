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
      className={`w-full rounded-md border bg-paper px-3 py-2 text-sm outline-none transition focus:border-accent ${
        invalid ? 'border-critical' : 'border-line'
      } ${className}`}
      {...rest}
    />
  );
});
