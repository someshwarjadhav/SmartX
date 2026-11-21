import type * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Layers,
  MousePointerClick,
  Pencil,
  RotateCcw,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import { Card, CardHeader } from "../../../components/operations/ui/Card";
import { Button } from "../../../components/operations/ui/Button";
import { Badge } from "../../../components/operations/ui/Badge";
import { Field, Input, Select } from "../../../components/operations/ui/Fields";
import {
  DataTable,
  type Column,
} from "../../../components/operations/ui/DataTable";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
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
import {
  applyOrder,
  getPriorityList,
  moveRow,
  savePriority,
} from "../../../services/billing/deductionPriority.api";
import {
  DEDUCTION_TYPES,
  NAME_MAX,
  NATURES,
  deleteHead,
  emptyHead,
  listHeads,
  saveHead,
  validateHead,
  type DeductionHead,
  type HeadErrors,
  type HeadInput,
  type Nature,
} from "../../../services/master/deductionMaster.api";

const TYPE_TONE: Record<string, "brand" | "ok" | "warn" | "neutral"> = {
  Standard: "brand",
  Percentage: "ok",
  Variable: "warn",
  Fix: "neutral",
  "On Bill Wise": "brand",
};

const msg = (e: unknown, fallback: string) =>
  e instanceof ApiError ? e.message : fallback;

const Err: React.FC<{ text?: string }> = ({ text }) =>
  text ? (
    <span className="mt-1 block text-xs font-semibold text-danger">{text}</span>
  ) : null;

const invalid = (e?: string) =>
  e ? "border-danger focus:border-danger focus:ring-danger/20" : "";

const NatureBadge: React.FC<{ nature: Nature }> = ({ nature }) => (
  <Badge tone={nature === "Addition" ? "ok" : "warn"} dot>
    {nature}
  </Badge>
);

const DeductionMaster: React.FC = () => {
  const toast = useToast();

  const [rows, setRows] = useState<DeductionHead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [saved, setSaved] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);

  const [editing, setEditing] = useState<DeductionHead | null>(null);
  const [form, setForm] = useState<HeadInput>(emptyHead());
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  const [toDelete, setToDelete] = useState<DeductionHead | null>(null);
  const [deleting, setDeleting] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  /** `keep` = the order on screen (unsaved moves survive an add / edit / delete); without it the saved order is used. */
  const load = useCallback(async (keep?: string[]) => {
    setLoading(true);
    setError(null);
    try {
      let list: DeductionHead[];
      if (keep) list = applyOrder(await listHeads(), keep);
      else {
        list = await getPriorityList();
        if (alive.current) setSaved(list.map((r) => r.code));
      }
      if (alive.current) setRows(list);
    } catch (e) {
      if (alive.current)
        setError(msg(e, "The deduction list could not be loaded."));
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const errors: HeadErrors = useMemo(
    () => (submitted ? validateHead(form, rows, editing?.code) : {}),
    [submitted, form, rows, editing],
  );

  const set = <K extends keyof HeadInput>(k: K, v: HeadInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const openEdit = (h: DeductionHead) => {
    setEditing(h);
    setForm({ name: h.name, type: h.type, nature: h.nature });
    setSubmitted(false);
    window.setTimeout(
      () =>
        formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      50,
    );
  };

  const resetForm = useCallback(() => {
    if (saving) return;
    setEditing(null);
    setForm(emptyHead());
    setSubmitted(false);
  }, [saving]);

  const submit = async () => {
    if (saving) return;
    setSubmitted(true);
    if (Object.keys(validateHead(form, rows, editing?.code)).length) return;
    setSaving(true);
    try {
      const saved = await saveHead(form, editing?.code);
      toast(
        editing
          ? `${saved.name} updated`
          : `${saved.name} added (code ${saved.code})`,
      );
      setEditing(null);
      setForm(emptyHead());
      setSubmitted(false);
      await load(rows.map((r) => r.code));
    } catch (e) {
      toast(msg(e, "The deduction could not be saved."), "warn");
    } finally {
      if (alive.current) setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete || deleting) return;
    setDeleting(true);
    try {
      await deleteHead(toDelete.code);
      toast(`${toDelete.name} deleted`);
      const gone = toDelete.code;
      setToDelete(null);
      if (selected === gone) setSelected(null);
      setSaved((c) => c.filter((x) => x !== gone));
      await load(rows.map((r) => r.code).filter((x) => x !== gone));
    } catch (e) {
      toast(msg(e, "The deduction could not be deleted."), "warn");
    } finally {
      if (alive.current) setDeleting(false);
    }
  };

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) =>
      [r.code, r.name, r.type, r.nature].some((x) =>
        x.toLowerCase().includes(t),
      ),
    );
  }, [rows, q]);

  const index = useMemo(
    () => rows.findIndex((r) => r.code === selected),
    [rows, selected],
  );
  const dirty = useMemo(() => {
    const want = applyOrder(rows, saved);
    return want.some((r, i) => r.code !== rows[i]?.code);
  }, [rows, saved]);
  const searching = q.trim() !== "";

  const move = (step: -1 | 1) => {
    if (index < 0 || searching) return;
    const next = moveRow(rows, index, step);
    if (next !== rows) setRows(next);
  };

  const saveOrder = async () => {
    if (savingOrder || !dirty) return;
    setSavingOrder(true);
    try {
      const codes = rows.map((r) => r.code);
      await savePriority(codes);
      setSaved(codes);
      toast("Order saved (same order is used in Deduction Priority)");
    } catch (e) {
      toast(msg(e, "The order could not be saved."), "warn");
    } finally {
      if (alive.current) setSavingOrder(false);
    }
  };

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const columns: Column<DeductionHead>[] = [
    {
      key: "order",
      header: "Order",
      cell: (r) => {
        const on = r.code === selected;
        return (
          <span
            className={cn(
              "tnum grid h-8 w-8 place-items-center rounded-full text-xs font-bold",
              on ? "bg-brand text-brand-ink" : "bg-brand/10 text-brand",
            )}
          >
            {rows.findIndex((x) => x.code === r.code) + 1}
          </span>
        );
      },
    },
    {
      key: "code",
      header: "Code",
      cell: (r) => (
        <span className="inline-flex rounded-lg bg-brand/10 px-2.5 py-1 text-xs font-bold text-brand">
          {r.code}
        </span>
      ),
    },
    {
      key: "name",
      header: "Deduction Name",
      cell: (r) => <span className="font-semibold">{r.name}</span>,
    },
    {
      key: "type",
      header: "Deduction Type",
      cell: (r) => <Badge tone={TYPE_TONE[r.type] ?? "neutral"}>{r.type}</Badge>,
    },
    {
      key: "nature",
      header: "Deduction/Addition",
      cell: (r) => <NatureBadge nature={r.nature} />,
    },
    {
      key: "edit",
      header: "Edit",
      align: "center",
      cell: (r) => (
        <span onClick={stop}>
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Edit ${r.name}`}
            title="Edit"
            icon={<Pencil size={14} />}
            onClick={() => openEdit(r)}
          />
        </span>
      ),
    },
    {
      key: "delete",
      header: "Delete",
      align: "center",
      cell: (r) => (
        <span onClick={stop}>
          <Button
            size="sm"
            variant="danger"
            className="!bg-danger/10 !text-danger !shadow-none hover:!bg-danger/20"
            aria-label={`Delete ${r.name}`}
            title="Delete"
            icon={<Trash2 size={14} />}
            onClick={() => setToDelete(r)}
          />
        </span>
      ),
    },
  ];

  return (
    <ReportPage
      title="Deduction Master"
      subtitle="Heads that can be cut from (or added to) a farmer's bill, such as Milk Advance, Cattle Feed or Commission."
    >
      {error ? (
        <ErrorBlock message={error} onRetry={() => void load()} busy={loading} />
      ) : (
        <>
        <Reveal delay={0.05}>
          <div ref={formRef} className="scroll-mt-4">
            <Card>
              <CardHeader
                title={
                  <CardTitle icon={Layers}>
                    {editing ? `Edit Deduction ${editing.code}` : "Deduction Information"}
                  </CardTitle>
                }
                subtitle={
                  editing
                    ? `Code ${editing.code}`
                    : "A new code is given automatically."
                }
                action={
                  editing ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<RotateCcw size={14} />}
                      onClick={resetForm}
                    >
                      Cancel edit
                    </Button>
                  ) : undefined
                }
              />
              <div
                className="space-y-5 px-5 pb-5 pt-3 sm:px-6 sm:pb-6"
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    e.target instanceof HTMLInputElement
                  ) {
                    e.preventDefault();
                    void submit();
                  }
                }}
              >
                <div className="grid items-end gap-4 md:grid-cols-3">
                  <div>
                    <Field label="Deduction Name">
                      <Input
                        autoFocus
                        value={form.name}
                        maxLength={NAME_MAX}
                        autoComplete="off"
                        aria-invalid={!!errors.name}
                        className={invalid(errors.name)}
                        onChange={(e) => set("name", e.target.value)}
                      />
                    </Field>
                    <Err text={errors.name} />
                  </div>
                  <div>
                    <Field label="Deduction Type">
                      <Select
                        value={form.type}
                        aria-invalid={!!errors.type}
                        className={invalid(errors.type)}
                        onChange={(e) =>
                          set("type", e.target.value as HeadInput["type"])
                        }
                      >
                        <option value="">Select Deduction Type</option>
                        {DEDUCTION_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Err text={errors.type} />
                  </div>
                  <div>
                    <Field label="Deduction / Addition">
                      <Select
                        value={form.nature}
                        onChange={(e) =>
                          set("nature", e.target.value as Nature)
                        }
                      >
                        {NATURES.map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Err text={errors.nature} />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Button
                    size="lg"
                    className="h-11 w-full bg-gradient-to-r from-brand to-glow"
                    icon={<Save size={15} />}
                    loading={saving}
                    onClick={() => void submit()}
                  >
                    {editing ? "Update" : "Save"}
                  </Button>
                  <Button
                    size="lg"
                    className="h-11 w-full"
                    variant="outline"
                    icon={<RotateCcw size={15} />}
                    disabled={saving}
                    onClick={resetForm}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <Card>
            <CardHeader
              title={<CardTitle icon={Layers}>Deductions</CardTitle>}
              subtitle={loading ? undefined : `${rows.length} in total`}
            />
            <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="w-full sm:max-w-sm">
                <Input
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search deduction..."
                  aria-label="Search deduction"
                  icon={<Search size={16} />}
                />
              </div>
            </div>

            {loading ? (
              <MilkLoader label="Loading deductions…" />
            ) : (
              <DataTable
                columns={columns}
                rows={shown}
                rowKey={(r) => r.code}
                onRowClick={(r) => setSelected((c) => (c === r.code ? null : r.code))}
                rowClassName={(r) => (r.code === selected ? "bg-brand/15" : undefined)}
                empty={
                  <EmptyState
                    title={q ? "No deduction matches your search" : "No deductions yet"}
                    hint={
                      q
                        ? "Try another name, code or type."
                        : "Use the form above to create the first one."
                    }
                  />
                }
              />
            )}

            {!loading && rows.length > 0 && (
              <>
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
                      <MousePointerClick size={15} /> Click a row, then use Up / Down to change its order
                    </p>
                  )}
                  <p className="text-xs text-mute sm:ml-auto">
                    {searching ? "Clear the search to move rows" : "Top = cut first · Bottom = cut last"}
                    {dirty ? " · Unsaved order" : ""}
                  </p>
                </div>
                <div className="grid gap-3 border-t border-line p-4 sm:grid-cols-3 sm:p-5">
                  <Button
                    variant="outline"
                    className="w-full"
                    icon={<ArrowUp size={16} />}
                    disabled={searching || index <= 0}
                    onClick={() => move(-1)}
                  >
                    Up
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    icon={<ArrowDown size={16} />}
                    disabled={searching || index < 0 || index >= rows.length - 1}
                    onClick={() => move(1)}
                  >
                    Down
                  </Button>
                  <Button
                    className="w-full"
                    icon={<Save size={16} />}
                    loading={savingOrder}
                    disabled={!dirty}
                    onClick={() => void saveOrder()}
                  >
                    Save
                  </Button>
                </div>
              </>
            )}
          </Card>
        </Reveal>
        </>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Delete deduction?"
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setToDelete(null)}
      >
        <p>
          <span className="font-semibold">{toDelete?.name}</span> (code{" "}
          {toDelete?.code}) will be removed from Deduction Master and from the
          priority list.
        </p>
      </ConfirmDialog>
    </ReportPage>
  );
};

export default DeductionMaster;
