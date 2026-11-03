import type * as React from "react";
import { useEffect, useState } from "react";
import { cn } from "../../lib/cn";

const HINTS = [
  "Fetching records from the portal…",
  "Preparing your table…",
  "Almost there…",
];


const ROWS: number[][] = [
  [14, 9, 24, 12, 12, 16],
  [14, 9, 20, 12, 12, 16],
  [14, 9, 28, 12, 12, 16],
  [14, 9, 18, 12, 12, 16],
  [14, 9, 24, 12, 12, 16],
  [14, 9, 22, 12, 12, 16],
];


const DropSpinner: React.FC = () => (
  <span
    className="relative grid h-14 w-14 shrink-0 place-items-center sm:h-16 sm:w-16"
    aria-hidden
  >
    <span className="tl-halo absolute inset-1 rounded-full bg-brand/20 blur-md" />
    <svg
      viewBox="0 0 64 64"
      className="absolute inset-0 h-full w-full text-brand"
    >
      <circle
        cx="32"
        cy="32"
        r="28"
        fill="none"
        stroke="currentColor"
        strokeOpacity=".15"
        strokeWidth="4"
      />
      <circle
        className="tl-ring"
        cx="32"
        cy="32"
        r="28"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="52 124"
      />
      <circle
        className="tl-ring-2"
        cx="32"
        cy="32"
        r="21"
        fill="none"
        stroke="rgb(var(--glow))"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="16 116"
      />
    </svg>
    <svg
      viewBox="0 0 24 24"
      className="tl-drop relative h-6 w-6 text-brand sm:h-7 sm:w-7"
    >
      <path
        d="M12 2.5c3.2 4.1 6 7.2 6 10.8a6 6 0 0 1-12 0c0-3.6 2.8-6.7 6-10.8Z"
        fill="currentColor"
      />
      <path
        d="M9.2 14a3 3 0 0 0 2.4 3"
        fill="none"
        stroke="#fff"
        strokeOpacity=".7"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  </span>
);


export const TableLoader: React.FC<{
  label?: string;
  className?: string;
  rows?: number;
}> = ({ label = "Loading data…", className, rows = 5 }) => {
  const [hint, setHint] = useState(0);

  useEffect(() => {
    const t = window.setInterval(
      () => setHint((h) => (h + 1) % HINTS.length),
      1200,
    );
    return () => window.clearInterval(t);
  }, []);

  return (
    <div
      className={cn("relative overflow-hidden", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">{label}</span>

      {/* table skeleton */}
      <div className="select-none px-4 py-4 opacity-70 sm:px-5" aria-hidden>
        <div className="mb-3 flex gap-3 rounded-lg bg-soft/70 px-3 py-3">
          {ROWS[0].map((w, i) => (
            <span
              key={i}
              className={cn(
                "skeleton h-3 rounded",
                i > 2 && "hidden sm:block",
                i > 4 && "hidden md:block",
              )}
              style={{ flex: `${w} 1 0` }}
            />
          ))}
        </div>
        <div className="divide-y divide-line/60">
          {Array.from({ length: rows }, (_, r) => ROWS[r % ROWS.length]).map(
            (cells, r) => (
              <div
                key={r}
                className="flex items-center gap-3 px-3 py-3.5"
                style={{ opacity: 1 - r * 0.1 }}
              >
                {cells.map((w, i) => (
                  <span
                    key={i}
                    className={cn(
                      "skeleton h-3.5 rounded",
                      i > 2 && "hidden sm:block",
                      i > 4 && "hidden md:block",
                    )}
                    style={{ flex: `${w} 1 0` }}
                  />
                ))}
              </div>
            ),
          )}
        </div>
      </div>

      {/* floating status card */}
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className="tl-card flex w-full max-w-sm items-center gap-4 rounded-2xl border border-line bg-panel/95 px-4 py-4 shadow-pop backdrop-blur sm:px-5">
          <DropSpinner />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-semibold sm:text-base">
              {label}
            </p>
            <p
              className="mt-0.5 min-h-4 truncate text-xs text-mute"
              key={hint}
              aria-hidden
            >
              <span className="tl-hint inline-block">{HINTS[hint]}</span>
            </p>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-brand/15">
              <span className="tl-bar block h-full w-1/2 rounded-full bg-gradient-to-r from-brand to-glow" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
