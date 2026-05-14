import { type TextareaHTMLAttributes, forwardRef } from 'react';

interface Props extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, Props>(function Textarea(
  { invalid = false, className = '', ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={`w-full rounded-md border bg-paper px-3 py-2 text-sm outline-none transition focus:border-accent ${
        invalid ? 'border-critical' : 'border-line'
      } ${className}`}
      {...rest}
    />
  );
});
