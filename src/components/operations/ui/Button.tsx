import type * as React from "react";
import { cloneElement, isValidElement } from "react";
import type { ButtonHTMLAttributes, ReactElement, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../../lib/portal/cn";

type Variant = "primary" | "soft" | "ghost" | "outline" | "danger";
interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  icon?: ReactNode;
  loading?: boolean;
}

const V: Record<Variant, string> = {
  primary:
    "bg-brand text-brand-ink shadow-card hover:brightness-110 active:brightness-95",
  soft: "bg-brand/10 text-brand hover:bg-brand/15",
  ghost: "text-mute hover:bg-soft hover:text-ink",
  outline:
    "border border-line text-ink hover:border-brand hover:text-brand bg-panel",
  danger: "bg-danger text-white shadow-card hover:brightness-110 active:brightness-95",
};
const ICON_PX = { sm: 15, md: 16, lg: 18 } as const;
const S = {
  sm: "h-9 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2.5",
};

export const Button: React.FC<Props> = ({
  variant = "primary",
  size = "md",
  icon,
  loading,
  className,
  children,
  disabled,
  ...rest
}) => {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl font-semibold transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-55",
        V[variant],
        S[size],
        className,
      )}
    >
      {loading ? (
        <Loader2 size={ICON_PX[size]} className="animate-spin" />
      ) : isValidElement(icon) ? (
        cloneElement(icon as ReactElement<{ size?: number }>, {
          size: ICON_PX[size],
        })
      ) : (
        icon
      )}
      {children}
    </button>
  );
};
