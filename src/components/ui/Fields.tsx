import type * as React from "react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
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

const splitLabel = (label: string): [string, string | null] => {
  const at = label.lastIndexOf(" | ");
  return at > 0 ? [label.slice(0, at), label.slice(at + 3)] : [label, null];
};

interface PopBox {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  listMax: number;
}

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
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [box, setBox] = useState<PopBox | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const searchable = options.length > 8;
  const selected = options.find((o) => o.value === value) ?? options[0];
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t
      ? options.filter((o) => o.label.toLowerCase().includes(t))
      : options;
  }, [options, q]);

  const close = useCallback(() => {
    setOpen(false);
    setQ("");
  }, []);

  const place = useCallback(() => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const up = below < 240 && above > below;
    const room = up ? above : below;
    setBox({
      left: r.left,
      width: r.width,
      ...(up
        ? { bottom: window.innerHeight - r.top + 6 }
        : { top: r.bottom + 6 }),
      listMax: Math.max(140, Math.min(room - (searchable ? 64 : 20), 340)),
    });
  }, [searchable]);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (pop.current?.contains(t) || btn.current?.contains(t)) return;
      close();
    };
    const onMove = (e: Event) => {
      if (e.target instanceof Node && pop.current?.contains(e.target)) return; // scrolling inside the list
      place();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open, close, place]);

  // on open: highlight the picked option and put the cursor in the list
  useEffect(() => {
    if (!open) return;
    const i = options.findIndex((o) => o.value === value);
    setActive(i >= 0 ? i : 0);
    (searchable ? searchRef.current : pop.current)?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => setActive(0), [q]);

  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-i="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, open, box]);

  const pick = (v: string) => {
    if (v !== value) onChange(v);
    close();
    btn.current?.focus();
  };

  const onPopKey = (e: React.KeyboardEvent) => {
    const last = Math.max(shown.length - 1, 0);
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      btn.current?.focus();
    } else if (e.key === "Tab") {
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, last));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(last);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const o = shown[active];
      if (o) pick(o.value);
    } else if (
      !searchable &&
      e.key.length === 1 &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey
    ) {
      // first letter jumps to the next option starting with it (like the old dropdown)
      const ch = e.key.toLowerCase();
      const from = shown.findIndex(
        (o, i) => i > active && o.label.toLowerCase().startsWith(ch),
      );
      const any =
        from >= 0
          ? from
          : shown.findIndex((o) => o.label.toLowerCase().startsWith(ch));
      if (any >= 0) setActive(any);
    }
  };

  const [selName, selCode] = splitLabel(selected?.label ?? "");

  return (
    <Field
      label={label}
      htmlFor={id}
      hint={hint}
      error={error}
      className={wrapperClassName}
    >
      <button
        ref={btn}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={error ? true : undefined}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (!open) setOpen(true);
          }
        }}
        className={cn(
          "relative flex h-11 w-full items-center rounded-xl border border-line bg-panel pl-3.5 pr-10 text-left text-base text-ink outline-none transition hover:border-brand/50 focus:border-brand focus:ring-4 focus:ring-brand/15 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger sm:text-sm",
          open && "border-brand ring-4 ring-brand/15",
        )}
      >
        <span className="min-w-0 flex-1 truncate">
          {selName}
          {selCode && <span className="text-mute"> | {selCode}</span>}
        </span>
        <ChevronDown
          size={16}
          className={cn(
            "pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-mute transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open &&
        box &&
        createPortal(
          <div
            ref={pop}
            tabIndex={-1}
            onKeyDown={onPopKey}
            style={{
              position: "fixed",
              left: box.left,
              width: box.width,
              top: box.top,
              bottom: box.bottom,
              zIndex: 80,
            }}
            className="overflow-hidden rounded-xl border border-line bg-panel shadow-pop outline-none"
          >
            {searchable && (
              <div className="relative border-b border-line">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-mute"
                  aria-hidden
                />
                <input
                  ref={searchRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search…"
                  aria-label="Search"
                  className="h-11 w-full bg-transparent pl-9 pr-3 text-sm text-ink outline-none placeholder:text-mute/70"
                />
              </div>
            )}
            <ul
              ref={listRef}
              role="listbox"
              aria-labelledby={id}
              style={{ maxHeight: box.listMax }}
              className="thin-scrollbar overflow-y-auto p-1.5"
            >
              {shown.map((o, i) => {
                const [name, code] = splitLabel(o.label);
                const isSel = o.value === value;
                return (
                  <li
                    key={o.value}
                    data-i={i}
                    role="option"
                    aria-selected={isSel}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(o.value)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                      i === active && "bg-brand/[0.09]",
                      isSel ? "font-semibold text-brand" : "text-ink",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{name}</span>
                    {code && (
                      <span className="tnum shrink-0 rounded-md bg-soft px-1.5 py-0.5 text-xs font-medium text-mute">
                        {code}
                      </span>
                    )}
                    {isSel && (
                      <Check
                        size={15}
                        className="shrink-0 text-brand"
                        aria-hidden
                      />
                    )}
                  </li>
                );
              })}
              {shown.length === 0 && (
                <li className="px-3 py-4 text-center text-xs text-mute">
                  Nothing matches.
                </li>
              )}
            </ul>
          </div>,
          document.body,
        )}
    </Field>
  );
};
