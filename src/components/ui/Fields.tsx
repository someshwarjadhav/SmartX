import type * as React from "react";
import { forwardRef, useId } from "react";
import { Dropdown } from "./Dropdown";
import { cn } from "../../lib/cn";
import type { Option } from "../../data/masters";

interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}

export const Field: React.FC<FieldProps> = ({
  label,
  htmlFor,
  hint,
  error,
  className,
  children,
}) => (
  <div className={cn("block min-w-0", className)}>
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold">
      {label}
    </label>
    {children}
    {error ? (
      <p role="alert" className="mt-1.5 text-xs font-semibold text-danger">
        {error}
      </p>
    ) : (
      hint && <p className="mt-1.5 text-xs text-mute">{hint}</p>
    )}
  </div>
);

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ icon, className, id, ...rest }, ref) => {
    const auto = useId();
    const keepCase =
      rest.autoCapitalize === "none" ||
      /password|username|email/i.test(rest.autoComplete ?? "");
    return (
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-mute">
            {icon}
          </span>
        )}
        <input
          ref={ref}
          id={id ?? auto}
          className={cn(
            "h-12 w-full rounded-xl border border-line bg-panel px-3.5 text-base text-ink outline-none transition placeholder:text-mute/70 focus:border-brand focus:ring-4 focus:ring-brand/15 disabled:cursor-not-allowed disabled:bg-soft/60 disabled:opacity-70 aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/10 sm:text-sm",

            (!rest.type || rest.type === "text") && !keepCase
              ? "capitalize"
              : "",
            icon ? "pl-10" : "",
            className,
          )}
          {...rest}
        />
      </div>
    );
  },
);
Input.displayName = "Input";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...rest }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-28 w-full resize-y rounded-xl border border-line bg-panel px-3.5 py-3 text-base text-ink outline-none transition placeholder:text-mute/70 focus:border-brand focus:ring-4 focus:ring-brand/15 sm:text-sm",
      className,
    )}
    {...rest}
  />
));
Textarea.displayName = "Textarea";

interface TextFieldProps extends InputProps {
  label: string;
  hint?: string;
  error?: string;
  wrapperClassName?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, hint, error, wrapperClassName, className, id, ...rest }, ref) => {
    const auto = useId();
    const fieldId = id ?? auto;
    return (
      <Field
        label={label}
        htmlFor={fieldId}
        hint={hint}
        error={error}
        className={wrapperClassName}
      >
        <Input
          ref={ref}
          id={fieldId}
          aria-invalid={error ? true : undefined}
          className={cn("h-11", className)}
          {...rest}
        />
      </Field>
    );
  },
);
TextField.displayName = "TextField";

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  error?: string;
  hint?: string;
  disabled?: boolean;
  wrapperClassName?: string;
}

/**
 * Same props and same behaviour as the old native <select> (value / onChange(value) / options / disabled / error / hint),
 * drawn with the shared Dropdown (rounded list, tick, code tag, scroll bar, search when the list is long).
 */
export const SelectField: React.FC<SelectFieldProps> = ({
  label,
  value,
  onChange,
  options,
  error,
  hint,
  disabled,
  wrapperClassName,
}) => {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} hint={hint} error={error} className={wrapperClassName}>
      <Dropdown
        id={id}
        value={value}
        onChange={onChange}
        options={options}
        disabled={disabled}
        invalid={Boolean(error)}
        className="h-11 w-full rounded-xl border border-line bg-panel pl-3.5 pr-10 text-base text-ink outline-none transition hover:border-brand/50 focus:border-brand focus:ring-4 focus:ring-brand/15 disabled:opacity-60 sm:text-sm"
      />
    </Field>
  );
};
