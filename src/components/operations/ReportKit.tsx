import type * as React from "react";
import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  Radio,
  RefreshCw,
} from "lucide-react";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { ResultPerPage } from "./ui/ResultPerPage";
import { PageHeader } from "./ui/PageHeader";
import { nf } from "../../lib/portal/format";
import { cn } from "../../lib/portal/cn";

export type ExportKind = "xls" | "pdf" | "csv";
/** Buttons the report bar can show: the three export kinds plus Print / Download (Farmer Bill). */
export type BarKind = ExportKind | "print" | "download";

export const IconBadge: React.FC<{
  icon: LucideIcon;
  tone?: string;
  size?: number;
}> = ({ icon: Icon, tone = "text-brand", size = 18 }) => (
  <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand/10 ring-1 ring-brand/15", tone)}>
    <Icon size={size} className={tone} />
  </span>
);

export const CardTitle: React.FC<{
  icon: LucideIcon;
  children: ReactNode;
  tone?: string;
}> = ({ icon, children, tone }) => (
  <span className="flex items-center gap-3">
    <IconBadge icon={icon} tone={tone} />
    {children}
  </span>
);

export const Reveal: React.FC<{
  children: ReactNode;
  delay?: number;
  className?: string;
}> = ({ children, delay = 0, className }) => (
  <motion.div
    className={className}
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.45, delay, ease: "easeOut" }}
  >
    {children}
  </motion.div>
);
export const ReportPage: React.FC<{ title: string; subtitle?: string; children: ReactNode }> = ({ title, subtitle, children }) => (
  <div className="min-w-0 space-y-4 sm:space-y-5">
    <Reveal>
      <PageHeader title={title} subtitle={subtitle} />
    </Reveal>
    {children}
  </div>
);

export interface ReportSourceState {
  fetching: boolean;
  stale: boolean;
  updatedAt: number | null;
  failed?: number;
  total?: number;
  error?: unknown;
  hasData?: boolean;
}

export const ReportDataBadge: React.FC<{ state: ReportSourceState }> = ({
  state,
}) => {
  const {
    fetching,
    stale,
    updatedAt,
    failed = 0,
    total = 0,
    error,
    hasData = false,
  } = state;
  const failedText =
    total > 0 && failed > 0 ? ` · ${failed}/${total} requests failed` : "";
  if (error && hasData) {
    return (
      <Badge
        tone="warn"
        dot
        title={`Showing previously loaded portal data. API refresh failed${failedText}.`}
      >
        Cached API data · refresh failed
      </Badge>
    );
  }
  if (error) {
    return (
      <Badge
        tone="danger"
        dot
        title="No report rows loaded; the live portal request failed."
      >
        <AlertCircle size={13} /> API unavailable
      </Badge>
    );
  }
  if (fetching && stale) {
    return (
      <Badge
        tone="warn"
        dot
        title="Showing saved API results while refreshing from the portal."
      >
        <RefreshCw size={13} /> Refreshing cached data
      </Badge>
    );
  }
  if (stale) {
    return (
      <Badge
        tone="neutral"
        dot
        title="These results came from the app's local cache and have not yet been refreshed from the portal."
      >
        <Database size={13} /> Cached API data
      </Badge>
    );
  }
  if (failed > 0) {
    return (
      <Badge
        tone="warn"
        dot
        title={`Some portal requests failed${failedText}.`}
      >
        Partial portal data{failedText}
      </Badge>
    );
  }
  if (fetching) {
    return (
      <Badge tone="brand" dot>
        <RefreshCw size={13} /> Updating from portal
      </Badge>
    );
  }
  if (updatedAt !== null) {
    const stamp = new Date(updatedAt).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    return (
      <Badge tone="ok" dot title={`Loaded from the SmartX portal at ${stamp}.`}>
        <Radio size={13} /> Portal API data
      </Badge>
    );
  }
  return (
    <Badge tone="neutral" dot>
      <Database size={13} /> Waiting for portal data
    </Badge>
  );
};

const LABEL: Record<BarKind, string> = {
  xls: "Excel",
  pdf: "PDF / Print",
  csv: "CSV",
  print: "Print",
  download: "Download",
};
const ICON: Record<BarKind, ReactNode> = {
  xls: <FileSpreadsheet size={15} />,
  pdf: <FileText size={15} />,
  csv: <Download size={15} />,
  print: <Printer size={15} />,
  download: <Download size={15} />,
};

export function ReportBar<K extends BarKind = ExportKind>({ count, hideCount, disabled, kinds, onExport, left, source, labels, pager }: {
  count: number;
  /** Paging of the table below: shows "Record Count: 1 - 100 of N" and the "Result per page" picker in this bar. */
  pager?: { page: number; size: number; onSize: (n: number) => void };
  hideCount?: boolean;
  disabled: boolean;
  kinds: K[];
  onExport: (k: K) => void;
  left?: ReactNode;
  source?: ReactNode;
  /** Optional button captions, e.g. { pdf: "Print Bill" }. */
  labels?: Partial<Record<K, string>>;
}) {
  // each button has its own lock: pressing one never greys out the others
  const locked = useRef<Set<K>>(new Set());
  const [busy, setBusy] = useState<ReadonlySet<K>>(() => new Set());
  const exportOnce = (kind: K) => {
    if (disabled || locked.current.has(kind)) return;
    locked.current.add(kind);
    setBusy(new Set(locked.current));
    try {
      onExport(kind);
    } finally {
      window.setTimeout(() => {
        locked.current.delete(kind);
        setBusy(new Set(locked.current));
      }, 700);
    }
  };
  return (
  <div className="flex flex-col gap-3 border-b border-line bg-soft/50 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-5">
    <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2">
      {left}
      {!hideCount && (
        <p className="tnum text-sm text-mute">
          <span className="font-bold text-ink">Record Count:</span>{" "}
          {pager ? `${count === 0 ? 0 : (pager.page - 1) * pager.size + 1} - ${Math.min(count, pager.page * pager.size)} of ${nf(count)}` : nf(count)}
        </p>
      )}
      {pager && count > 0 && <ResultPerPage size={pager.size} onSize={pager.onSize} />}
      {source}
    </div>
    <div className="flex flex-wrap gap-2">
      {kinds.map((k) => (
        <motion.div key={k} whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }}>
          <Button
            type="button"
            size="sm"
            variant={k === "pdf" ? "danger" : k === "csv" ? "outline" : "primary"}
            icon={ICON[k]}
            onClick={() => exportOnce(k)}
            disabled={disabled || busy.has(k)}
          >
            {labels?.[k] ?? LABEL[k]}
          </Button>
        </motion.div>
      ))}
    </div>
  </div>
  );
}