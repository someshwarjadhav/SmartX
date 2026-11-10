import type * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  CheckCircle2,
  Download,
  Hash,
  Layers,
  Eye,
  EyeOff,
  Pencil,
  RefreshCw,
  RotateCcw,
  Save,
} from "lucide-react";
import { Card, CardHeader } from "../../../components/operations/ui/Card";
import { Button } from "../../../components/operations/ui/Button";
import { Badge } from "../../../components/operations/ui/Badge";
import { StatCard } from "../../../components/operations/ui/StatCard";
import { Field, Input, Select } from "../../../components/operations/ui/Fields";
import { DataTable, type Column } from "../../../components/operations/ui/DataTable";
import { ErrorBlock } from "../../../components/operations/Widget";
import { MilkLoader } from "../../../components/operations/MilkLoader";
import { CardTitle, ReportPage, Reveal } from "../../../components/operations/ReportKit";
import { useToast } from "../../../context/ToastContext";
import { getSession, patchSessionVlcc } from "../../../services/session";
import { refreshSessionCenters } from "../../../services/bootstrap";
import { SHOW_CUSTOMER_ID } from "../../../services/config";
import { ApiError } from "../../../services/http/errors";
import { GLOBALS } from "../../../lib/portal/global";
import {
  assertConfigured,
  createVillage,
  emptyVlc,
  getMaxVlcc,
  getMccRoute,
  getVillageById,
  getVillageDetails,
  putVillageStations,
  updateVillage,
  VLC_TYPES,
  type VlcInput,
  type VlcRecord,
  type VlcRoute,
  type VlcSlots,
} from "../../../services/master/vlcMaster.api.ts";
import { exportVlcMaster } from "../../../assets/excel/vlcMaster.excel.ts";

const msg = (e: unknown, fallback: string) =>
  e instanceof ApiError ? e.message : fallback;

const digits = (v: string, max: number) => v.replace(/\D/g, "").slice(0, max);
const randomPass = () => String(Math.floor(100000 + Math.random() * 900000));

const Err: React.FC<{ text?: string }> = ({ text }) =>
  text ? (
    <span className="mt-1 block text-xs font-semibold text-danger">{text}</span>
  ) : null;

const invalid = (e?: string) =>
  e ? "border-danger focus:border-danger focus:ring-danger/20" : "";

const Section: React.FC<{ title: string; hint?: string }> = ({ title, hint }) => (
  <div className="flex items-center gap-3">
    <p className="shrink-0 text-xs font-bold uppercase tracking-wider text-brand">{title}</p>
    <span className="h-px flex-1 bg-gradient-to-r from-line to-transparent" aria-hidden />
    {hint && <p className="hidden text-xs text-mute sm:block">{hint}</p>}
  </div>
);

const PassInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  label: string;
}> = ({ value, onChange, disabled, label }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        inputMode="numeric"
        aria-label={label}
        autoComplete="new-password"
        disabled={disabled}
        value={value}
        className="pr-10"
        onChange={(e) => onChange(digits(e.target.value, 10))}
      />
      <button
        type="button"
        aria-label={show ? "Hide password" : "Show password"}
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-mute hover:text-ink"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
};

const VlcMaster: React.FC = () => {
  const toast = useToast();
  const sess = getSession();

  const mccid =
    sess?.mccLoginId ||
    GLOBALS.mccLoginId ||
    sess?.mccId ||
    GLOBALS.mccid ||
    "";
  const plantid = GLOBALS.plantid || "";
  const userId = GLOBALS.userid || "";

  const [routes, setRoutes] = useState<VlcRoute[]>([]);
  const [routeId, setRouteId] = useState("");
  const [slots, setSlots] = useState<VlcSlots | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [rows, setRows] = useState<VlcRecord[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const [form, setForm] = useState<VlcInput>(emptyVlc());
  const [editing, setEditing] = useState<VlcRecord | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const set = <K extends keyof VlcInput>(k: K, v: VlcInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    let alive = true;
    setError(null);
    setSlotsLoading(true);
    (async () => {
      try {
        assertConfigured(mccid, plantid);
        const [r, s] = await Promise.all([
          getMccRoute(mccid, plantid),
          getMaxVlcc(mccid, plantid).catch((e) => {
            console.warn("[vlc] getMaxVlcc failed:", e);
            return null;
          }),
        ]);
        if (!alive) return;
        setRoutes(r);
        setSlots(s);
        setSlotsLoading(false);
        setRouteId((cur) =>
          r.some((x) => x.routeId === cur) ? cur : (r[0]?.routeId ?? ""),
        );
      } catch (e) {
        if (alive) {
          setSlotsLoading(false);
          setError(msg(e, "The MCC / route list could not be loaded."));
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [mccid, plantid, tick]);

  useEffect(() => {
    if (!routeId) {
      setRows([]);
      setListLoading(false);
      return;
    }
    let alive = true;
    setListLoading(true);
    getVillageDetails(mccid, routeId)
      .then((l) => alive && setRows(l))
      .catch((e) => {
        if (!alive) return;
        setRows([]);
        toast(msg(e, "The VLC list could not be loaded."), "warn");
      })
      .finally(() => alive && setListLoading(false));
    return () => {
      alive = false;
    };
  }, [mccid, routeId, tick]);

  const stat = useMemo(() => {
    const n = (v?: string) => (v !== undefined && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null);
    const used = n(slots?.used) ?? (slots ? null : rows.length);
    const allocated = n(slots?.allocated);
    const available =
      n(slots?.available) ??
      (allocated !== null && used !== null ? Math.max(allocated - used, 0) : null);
    return { allocated: allocated ?? 0, used: used ?? 0, available: available ?? 0 };
  }, [slots, rows.length]);

  useEffect(() => {
    if (editing) return;
    setForm((f) => ({ ...f, villageId: slots?.nextVillageId ?? f.villageId }));
  }, [slots?.nextVillageId, editing]);

  const errors = useMemo(() => {
    const e: Partial<Record<keyof VlcInput, string>> = {};
    const typed = form.villageId.trim();
    if (!typed) e.villageId = "VLC id is required";
    else if (
      rows.some(
        (r) =>
          r.villageId !== editing?.villageId &&
          (r.villageId === typed || r.displayId === typed),
      )
    )
      e.villageId = "This VLC id already exists";
    if (!form.villageName.trim()) e.villageName = "VLC name is required";
    if (form.contact && !/^\d{10}$/.test(form.contact))
      e.contact = "Enter a 10 digit number";
    if (form.passApply) {
      if (!/^\d{4,10}$/.test(form.newPass))
        e.newPass = "Enter the new password (digits only)";
    }
    return e;
  }, [form, rows, editing]);
  const shown = (k: keyof VlcInput) => (submitted ? errors[k] : undefined);

  const resetForm = useCallback(() => {
    setEditing(null);
    setSubmitted(false);
    setForm(emptyVlc(slots?.nextVillageId ?? ""));
  }, [slots?.nextVillageId]);

  const refresh = () => setTick((t) => t + 1);

  const syncStations = async (saved: VlcInput, wasEdit: boolean) => {
    const id = saved.villageId.trim();
    const customId = saved.customerId.trim() || id;
    const prev = getSession();
    const known = prev?.stationByVlcc?.[id] ?? "";
    const changed = !wasEdit || customId !== (known || id);

    patchSessionVlcc({
      villageId: id,
      name: saved.villageName.trim(),
      customId: customId !== id || known ? customId : undefined,
    });

    if (SHOW_CUSTOMER_ID && changed) {
      const ses = getSession();
      const ids = ses?.vlccIds ?? [id];
      const customs = ids.map((v) => ses?.stationByVlcc?.[v] || v);
      const loginId = GLOBALS.userid || ses?.mccLoginId || GLOBALS.id || "";
      await putVillageStations(ids, customs, String(loginId));
    }
    void refreshSessionCenters();
  };

  const submit = async () => {
    setSubmitted(true);
    const first = Object.values(errors)[0];
    if (first) return toast(first, "warn");
    if (!routeId) return toast("Select the MCC / BMC first", "warn");
    if (
      !editing &&
      slots?.nextVillageId &&
      slots.available !== "" &&
      Number(slots.available) <= 0
    )
      return toast("No station id is available for this MCC/BMC.", "warn");
    if (saving) return;
    setSaving(true);
    try {
      const ctx = {
        mccid,
        routeid: routeId,
        userId,
        rateId: editing?.rateId,
      };
      const typed = form.villageId.trim();
      const stationId = editing
        ? editing.villageId
        : slots?.nextVillageId || typed;
      const saved: VlcInput = {
        ...form,
        villageId: stationId,
        customerId: typed !== stationId ? typed : "",
      };
      if (editing) await updateVillage(saved, ctx);
      else await createVillage(saved, ctx);
      toast(editing ? "VLC updated successfully!" : "VLC saved successfully!");
      try {
        await syncStations(saved, !!editing);
      } catch (e) {
        toast(
          msg(e, "The VLC is saved, but the customer id could not be linked."),
          "warn",
        );
      }
      setEditing(null);
        setSubmitted(false);
      setForm(emptyVlc());

      refresh();
    } catch (e) {
      toast(msg(e, "The VLC could not be saved"), "warn");
    } finally {
      setSaving(false);
    }
  };

  const edit = async (r: VlcRecord) => {
    setOpening(r.key);
    let rec = r;
    try {
      const got = await getVillageById(r.villageId);
      if (got)
        rec = {
          ...r,
          ...Object.fromEntries(
            Object.entries(got).filter(([, v]) => v !== ""),
          ),
        } as VlcRecord;
    } catch {}
    setOpening(null);
    setEditing(r);
    setSubmitted(false);
    setForm({
      villageId: rec.customId || rec.villageId,
      customerId: "",
      villageName: rec.villageName,
      type: rec.type || VLC_TYPES[0],
      active: rec.active,
      agentName: rec.agentName,
      contact: rec.contact,
      pcbNo: rec.pcbNo,
      currentPass: rec.ekoPass,
      newPass: "",
      passApply: false,
    });
    window.setTimeout(
      () =>
        formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      50,
    );
  };

  const exportList = async () => {
    if (!rows.length) return toast("There is nothing to export", "warn");
    await exportVlcMaster(rows, "VillageMaster");
    toast("Excel file downloaded");
  };

  const cols: Column<VlcRecord>[] = [
    {
      key: "id",
      header: "Village Id",
      sort: (r) => Number(r.villageId) || 0,
      cell: (r) => r.displayId || r.villageId || "—",
    },
    {
      key: "name",
      header: "Village Name",
      sort: (r) => r.villageName,
      cell: (r) => r.villageName || "—",
    },
    { key: "agent", header: "Agent Name", cell: (r) => r.agentName || "—" },
    { key: "contact", header: "Contact", cell: (r) => r.contact || "—" },
    {
      key: "st",
      header: "Status",
      cell: (r) =>
        r.active ? (
          <Badge tone="ok" dot>
            Active
          </Badge>
        ) : (
          <Badge tone="neutral" dot>
            Inactive
          </Badge>
        ),
    },
    { key: "pcb", header: "PCB No", cell: (r) => r.pcbNo || "—" },
    { key: "pass", header: "EUP Pass", cell: (r) => r.ekoPass || "—" },
    {
      key: "act",
      header: "Action",
      cell: (r) => (
        <button
          aria-label={`Edit ${r.villageName}`}
          title="Edit"
          disabled={opening === r.key}
          onClick={() => void edit(r)}
          className="text-brand hover:opacity-70 disabled:opacity-40"
        >
          <Pencil size={16} />
        </button>
      ),
    },
  ];

  return (
    <ReportPage title="VLC Master" subtitle="Create and edit collection centres (VLCs), their contact, device serial and login password.">
      {error ? (
        <Card>
          <ErrorBlock message={error} onRetry={refresh} />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
            <StatCard compact tone="text-brand" label="Allocated Station Id" icon={<Hash />} value={stat.allocated} loading={slotsLoading} hint="Station ids given to this MCC/BMC" />
            <StatCard compact tone="text-warn" label="Used Station Id" icon={<Layers />} value={stat.used} loading={slotsLoading} hint="Already linked to a VLC" />
            <StatCard compact tone="text-ok" label="Available Station Id" icon={<CheckCircle2 />} value={stat.available} loading={slotsLoading} hint="Free to give to a new VLC" />
            <StatCard compact tone="text-brand" label="VLCs Listed" icon={<Building2 />} value={rows.length} loading={listLoading} hint="Centres under this MCC/BMC" />
          </div>

          <Reveal delay={0.05}>
            <div ref={formRef} className="scroll-mt-4">
              <Card>
                <CardHeader
                  title={
                    <CardTitle icon={Building2}>
                      {editing
                        ? `Edit VLC ${editing.displayId || editing.villageId}`
                        : "VLC (Village Level Center)"}
                    </CardTitle>
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
                <div className="space-y-5 px-5 pb-5 pt-3 sm:px-6 sm:pb-6">
                  <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
                    <Field
                      label="MCC/BMC Name"
                      className="w-full max-w-md flex-1"
                    >
                      <Select
                        value={routeId}
                        disabled={!!editing}
                        onChange={(e) => setRouteId(e.target.value)}
                      >
                        {routes.length === 0 && (
                          <option value="">-- no MCC / BMC --</option>
                        )}
                        {routes.map((r) => (
                          <option key={r.routeId} value={r.routeId}>
                            {r.routeName || r.routeId}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>

                  <Section title="Centre details" hint="Id, name and type of the VLC" />
                  <div className="grid items-end gap-4 md:grid-cols-[10rem_minmax(0,1fr)_minmax(0,16rem)_auto]">
                    <Field label="VLC ID">
                      <Input
                        inputMode="numeric"
                        value={form.villageId}
                        className={invalid(shown("villageId"))}
                        onChange={(e) =>
                          set("villageId", digits(e.target.value, 12))
                        }
                      />
                      <Err text={shown("villageId")} />
                    </Field>
                    <Field label="VLC Name">
                      <Input
                        value={form.villageName}
                        maxLength={60}
                        className={invalid(shown("villageName"))}
                        onChange={(e) => set("villageName", e.target.value)}
                      />
                      <Err text={shown("villageName")} />
                    </Field>
                    <Field label="VLC Type">
                      <Select
                        value={form.type}
                        onChange={(e) => set("type", e.target.value)}
                      >
                        {!VLC_TYPES.includes(form.type) && form.type && (
                          <option value={form.type}>{form.type}</option>
                        )}
                        {VLC_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <label className="flex h-10 cursor-pointer items-center gap-2.5 text-sm font-semibold">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-line accent-brand"
                        checked={form.active}
                        onChange={(e) => set("active", e.target.checked)}
                      />
                      VLC Active
                    </label>
                  </div>

                  <Section title="Contact" />
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Contact Person">
                      <Input
                        value={form.agentName}
                        maxLength={60}
                        onChange={(e) => set("agentName", e.target.value)}
                      />
                    </Field>
                    <Field label="Contact">
                      <Input
                        inputMode="numeric"
                        value={form.contact}
                        className={invalid(shown("contact"))}
                        onChange={(e) =>
                          set("contact", digits(e.target.value, 10))
                        }
                      />
                      <Err text={shown("contact")} />
                    </Field>
                  </div>

                  <Section title="Device & password" hint="PCB serial and login password for the machine" />
                  <div className="grid items-end gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                    <Field label="PCB SerialNo">
                      <Input
                        inputMode="numeric"
                        value={form.pcbNo}
                        maxLength={15}
                        onChange={(e) =>
                          set("pcbNo", digits(e.target.value, 15))
                        }
                      />
                    </Field>
                    <Field label="Current Password">
                      <PassInput
                        label="Current password"
                        value={form.currentPass}
                        onChange={(v) => set("currentPass", v)}
                      />
                    </Field>
                    <Field label="New Password">
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <PassInput
                            label="New password"
                            disabled={!form.passApply}
                            value={form.newPass}
                            onChange={(v) => set("newPass", v)}
                          />
                        </div>
                        <button
                          type="button"
                          title="Generate password"
                          aria-label="Generate password"
                          disabled={!form.passApply}
                          onClick={() => set("newPass", randomPass())}
                          className="text-brand hover:opacity-70 disabled:opacity-40"
                        >
                          <RefreshCw size={18} />
                        </button>
                      </div>
                      <Err text={shown("newPass")} />
                    </Field>
                    <label className="flex h-10 cursor-pointer items-center gap-2.5 text-sm font-semibold">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-line accent-brand"
                        checked={form.passApply}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            passApply: e.target.checked,
                            newPass: e.target.checked ? f.newPass : "",
                          }))
                        }
                      />
                      Password Apply
                    </label>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Button
                      size="lg"
                      className="h-11 w-full bg-gradient-to-r from-brand to-glow"
                      icon={<Save size={15} />}
                      loading={saving}
                      disabled={!routeId}
                      onClick={() => void submit()}
                    >
                      {editing ? "Update" : "Submit"}
                    </Button>
                    <Button
                      size="lg"
                      className="h-11 w-full"
                      variant="outline"
                      icon={<RotateCcw size={15} />}
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
                title={<CardTitle icon={Building2}>VLC list</CardTitle>}
                subtitle={rows.length ? `${rows.length} centres under this MCC/BMC` : undefined}
                action={
                  <Button size="sm" icon={<Download size={15} />} onClick={() => void exportList()}>
                    Excel Export
                  </Button>
                }
              />
              {listLoading ? (
                <div className="px-5 pb-8 sm:px-6">
                  <MilkLoader variant="image" label="Loading VLC list…" />
                </div>
              ) : (
                <DataTable
                  key={routeId}
                  columns={cols}
                  rows={rows}
                  rowKey={(r) => r.key}
                  pageSizes={[10, 25, 50, 100]}
                />
              )}
            </Card>
          </Reveal>
        </>
      )}
    </ReportPage>
  );
};

export default VlcMaster;
