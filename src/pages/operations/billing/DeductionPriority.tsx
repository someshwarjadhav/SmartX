import type * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ListOrdered, MousePointerClick, Save } from "lucide-react";
import { Card, CardHeader } from "../../../components/operations/ui/Card";
import { Button } from "../../../components/operations/ui/Button";
import { Badge } from "../../../components/operations/ui/Badge";
import { ErrorBlock } from "../../../components/operations/Widget";
import { MilkLoader } from "../../../components/operations/MilkLoader";
import { EmptyState } from "../../../components/operations/EmptyState";
import {
  CardTitle,
  ReportPage,
  Reveal,
} from "../../../components/operations/ReportKit";
import { useToast } from "../../../context/ToastContext";
import { cn } from "../../../lib/portal/cn";
import { ApiError } from "../../../services/http/errors";
import type { DeductionHead } from "../../../services/master/deductionMaster.api";
import {
  getPriorityList,
  moveRow,
  savePriority,
} from "../../../services/billing/deductionPriority.api";

const msg = (e: unknown, fallback: string) =>
  e instanceof ApiError ? e.message : fallback;

const th =
  "sticky top-0 z-10 whitespace-nowrap border-b border-line bg-soft px-3 py-3 text-left text-xs font-bold uppercase tracking-wide text-mute sm:px-4";
const td = "border-b border-line/70 px-3 py-3 sm:px-4";

const DeductionPriority: React.FC = () => {
  const toast = useToast();

  const [rows, setRows] = useState<DeductionHead[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const alive = useRef(true);
  const bodyRef = useRef<HTMLTableSectionElement>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await getPriorityList();
      if (!alive.current) return;
      setRows(list);
      setSaved(list.map((r) => r.code));
      setSelected(null);
    } catch (e) {
      if (alive.current)
        setError(msg(e, "The deduction priority could not be loaded."));
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const index = useMemo(
    () => rows.findIndex((r) => r.code === selected),
    [rows, selected],
  );
  const dirty = useMemo(
    () => rows.length !== saved.length || rows.some((r, i) => r.code !== saved[i]),
    [rows, saved],
  );

  const move = (step: -1 | 1) => {
    if (index < 0) return;
    const next = moveRow(rows, index, step);
    if (next === rows) return;
    setRows(next);
    requestAnimationFrame(() =>
      bodyRef.current
        ?.querySelector<HTMLElement>(`[data-code="${selected}"]`)
        ?.scrollIntoView({ block: "nearest" }),
    );
  };

  const save = async () => {
    if (saving || !dirty) return;
    setSaving(true);
    try {
      const codes = rows.map((r) => r.code);
      await savePriority(codes);
      setSaved(codes);
      toast("Deduction priority saved");
    } catch (e) {
      toast(msg(e, "The deduction priority could not be saved."), "warn");
    } finally {
      if (alive.current) setSaving(false);
    }
  };

  const onRowKey = (e: React.KeyboardEvent, code: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setSelected(code);
    }
  };

  return (
    <ReportPage
      title="Deduction Priority"
      subtitle="Order in which deductions are cut from a farmer's bill. The row at the top is cut first."
    >
      {error ? (
        <ErrorBlock message={error} onRetry={() => void load()} busy={loading} />
      ) : (
        <Reveal delay={0.05}>
          <Card>
            <CardHeader
              title={<CardTitle icon={ListOrdered}>Priority order</CardTitle>}
              subtitle={
                loading
                  ? undefined
                  : "Select a row, move it with Up / Down, then press Save."
              }
              action={
                dirty ? <Badge tone="warn" dot>Unsaved changes</Badge> : undefined
              }
            />

            {loading ? (
              <MilkLoader label="Loading priority…" />
            ) : rows.length === 0 ? (
              <EmptyState
                title="No records found"
                hint="Add deductions in Deduction Master first, they will appear here."
              />
            ) : (
              <div className="max-h-[55vh] overflow-auto">
                <table className="w-full border-separate border-spacing-0 text-[13px]">
                  <thead>
                    <tr>
                      <th scope="col" className={cn(th, "w-16")}>Order</th>
                      <th scope="col" className={th}>Code</th>
                      <th scope="col" className={th}>Deduction Name</th>
                      <th scope="col" className={cn(th, "hidden sm:table-cell")}>Deduction Type</th>
                      <th scope="col" className={cn(th, "hidden sm:table-cell")}>Deduction/Addition</th>
                    </tr>
                  </thead>
                  <tbody ref={bodyRef}>
                    {rows.map((r, i) => {
                      const on = r.code === selected;
                      return (
                        <tr
                          key={r.code}
                          data-code={r.code}
                          tabIndex={0}
                          aria-selected={on}
                          onClick={() => setSelected(on ? null : r.code)}
                          onKeyDown={(e) => onRowKey(e, r.code)}
                          className={cn(
                            "cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/50",
                            on ? "bg-brand/15" : "hover:bg-brand/[0.06]",
                          )}
                        >
                          <td className={cn(td, on && "shadow-[inset_4px_0_0_0_rgb(var(--brand))]")}>
                            <span
                              className={cn(
                                "tnum grid h-8 w-8 place-items-center rounded-full text-xs font-bold",
                                on ? "bg-brand text-brand-ink" : "bg-brand/10 text-brand",
                              )}
                            >
                              {i + 1}
                            </span>
                          </td>
                          <td className={td}>
                            <span className="inline-flex rounded-lg bg-soft px-2.5 py-1 text-xs font-bold">
                              {r.code}
                            </span>
                          </td>
                          <td className={td}>
                            <span className="block font-semibold">{r.name}</span>
                            <span className="mt-0.5 block text-xs text-mute sm:hidden">
                              {r.type} · {r.nature}
                            </span>
                          </td>
                          <td className={cn(td, "hidden sm:table-cell")}>{r.type}</td>
                          <td className={cn(td, "hidden sm:table-cell")}>
                            <Badge tone={r.nature === "Addition" ? "ok" : "warn"} dot>
                              {r.nature}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {!loading && rows.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line bg-soft/50 px-4 py-2.5 text-sm sm:px-5">
                {index >= 0 ? (
                  <p>
                    <span className="font-semibold">{rows[index].name}</span>{" "}
                    <span className="text-mute">
                      is number {index + 1} of {rows.length}
                      {index === 0 ? " (cut first)" : index === rows.length - 1 ? " (cut last)" : ""}
                    </span>
                  </p>
                ) : (
                  <p className="flex items-center gap-2 text-mute">
                    <MousePointerClick size={15} /> Click a row to select it
                  </p>
                )}
                <p className="text-xs text-mute sm:ml-auto">Top = cut first · Bottom = cut last</p>
              </div>
            )}
            <div className="grid gap-3 border-t border-line p-4 sm:grid-cols-3 sm:p-5">
              <Button
                variant="outline"
                className="w-full"
                icon={<ArrowUp size={16} />}
                disabled={loading || index <= 0}
                onClick={() => move(-1)}
              >
                Up
              </Button>
              <Button
                variant="outline"
                className="w-full"
                icon={<ArrowDown size={16} />}
                disabled={loading || index < 0 || index >= rows.length - 1}
                onClick={() => move(1)}
              >
                Down
              </Button>
              <Button
                className="w-full"
                icon={<Save size={16} />}
                loading={saving}
                disabled={loading || !dirty}
                onClick={() => void save()}
              >
                Save
              </Button>
            </div>
          </Card>
        </Reveal>
      )}
    </ReportPage>
  );
};

export default DeductionPriority;
