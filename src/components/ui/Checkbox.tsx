import type * as React from 'react';
import { useEffect, useRef } from 'react';
import { cn } from '../../lib/cn';

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
  indeterminate?: boolean;
}

export const Checkbox: React.FC<Props> = ({ label, indeterminate = false, className, ...rest }) => {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <label className={cn('inline-flex cursor-pointer select-none items-center gap-2 text-sm font-semibold', rest.disabled && 'cursor-not-allowed opacity-60', className)}>
      <input
        ref={ref}
        type="checkbox"
        className="h-[18px] w-[18px] shrink-0 cursor-pointer rounded border-line accent-brand transition disabled:cursor-not-allowed"
        {...rest}
      />
      {label}
    </label>
  );
};
