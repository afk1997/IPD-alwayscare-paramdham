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
      // 16px on mobile prevents iOS Safari auto-zoom on focus.
      className={`w-full rounded-md border bg-paper px-3 py-2 text-base outline-none transition focus:border-accent md:text-sm ${
        invalid ? 'border-critical' : 'border-line'
      } ${className}`}
      {...rest}
    />
  );
});
