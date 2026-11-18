import type * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Eye, Pencil, RotateCcw, Save, Trash2, Users, X } from "lucide-react";
import { Card, CardHeader } from "../../../components/operations/ui/Card";
import { Button } from "../../../components/operations/ui/Button";
import { Field, Input, Select } from "../../../components/operations/ui/Fields";
import {
  DataTable,
  type Column,
} from "../../../components/operations/ui/DataTable";
import { Modal } from "../../../components/operations/ui/Modal";
import { MilkLoader } from "../../../components/operations/MilkLoader";
import { ErrorBlock } from "../../../components/operations/Widget";


const BIG = "!h-20 !text-center !text-2xl !font-semibold sm:!text-3xl";
import {
  CardTitle,
  ReportBar,
  ReportPage,
  Reveal,
} from "../../../components/operations/ReportKit";
import { exportExcel, type ExportCol } from "../../../assets/excel/portalExport";
import { useToast } from "../../../context/ToastContext";
import { fmtDate, nf, todayISO } from "../../../lib/portal/format";
import {
  DEFAULT_PAGE_SIZE,
  GLOBALLABELS,
  GLOBALSSHIFT,
} from "../../../lib/portal/global";
import { useCenters } from "../../../hooks/useSessionData";
import { ALL } from "../../../hooks/useMilkReportData";
import { getSession } from "../../../services/session";
import { vlccCode, vlccOption, vlccTitle } from "../../../services/vlcc/names";
import {
  getFarmers,
  getRateChart,
  lookupRate,
  postFarmerMilk,
  type RateRow,
} from "../../../services/transaction/farmerMilk.api.ts";
import {
  deleteEntry,
  forgetCachedLists,
  getCollection,
  updateEntry,
  type CollectionRow,
} from "../../../services/transaction/manageCollection.api.ts";
import { norm } from "../../../services/utils/loose";
import type { MasterFarmer } from "../../../services/farmer/farmerBook";
import { ApiError } from "../../../services/http/errors";
import { focusFirstEmpty, handleEnterNext } from "../../../hooks/useEnterNext";

const SHIFTS = GLOBALSSHIFT.shiftOptions.filter(
  (s) => s.Id === "M" || s.Id === "E",
);
const MILKS = [
  { Id: "C", Name: "Cow" },
  { Id: "B", Name: "Buffalo" },
  { Id: "M", Name: "Mix" },
];

const num = (s: string) => {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};
const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

const clrFrom = (snf: number, fat: number) => r1((snf - 0.21 * fat - 0.36) * 4);

const farmerLabel = (f: MasterFarmer) =>
  f.name ? `${f.farmerId} - ${f.name}` : f.farmerId;


const KG_PER_LITRE = 1.03;
const two = (n: number) => n.toFixed(2);

const val = (r: CollectionRow, ...keys: string[]): string => {
  const wanted = keys.map(norm);
  for (const k of Object.keys(r)) {
    if (
      wanted.includes(norm(k)) &&
      r[k] !== null &&
      r[k] !== undefined &&
      String(r[k]).trim() !== ""
    )
      return String(r[k]).trim();
  }
  return "";
};

const milkCode = (v: string) => {
  const x = v.trim().toLowerCase();
  if (x === "c" || x === "cow") return "C";
  if (x === "b" || x === "buff" || x === "buffalo") return "B";
  return "M";
};
const milkName = (code: string) =>
  MILKS.find((m) => m.Id === code)?.Name ?? "Mix";

const MONTHS = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
];
const toIsoDate = (s: string): string => {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const m = /^(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\s+(\d{4})/.exec(s.trim());
  if (!m) return "";
  const month = MONTHS.indexOf(m[2].toLowerCase()) + 1;
  if (month < 1) return "";
  return `${m[3]}-${String(month).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
};

const idOf = (r: CollectionRow) => val(r, "maxid");

const TEXT_COLS: Array<{
  key: string;
  header: string;
  align?: "right";
  get: (r: CollectionRow) => string;
}> = [
  { key: "date", header: "Date", get: (r) => val(r, "trdate", "date") },
  { key: "shift", header: "Shift", get: (r) => val(r, "shift") },
  { key: "fid", header: "Farmer Id", get: (r) => val(r, "farmerid") },
  { key: "fname", header: "Name", get: (r) => val(r, "farmername", "name") },
  { key: "liter", header: "Liter", align: "right", get: (r) => val(r, "qty") },
  { key: "kg", header: "Kg", align: "right", get: (r) => val(r, "kg") },
  { key: "fat", header: "Fat", align: "right", get: (r) => val(r, "fat") },
  { key: "snf", header: "Snf", align: "right", get: (r) => val(r, "snf") },
  { key: "clr", header: "Clr", align: "right", get: (r) => val(r, "clr") },
  { key: "milk", header: "Milk Type", get: (r) => val(r, "milktype") },
 
  { key: "station", header: "Station Id", get: (r) => vlccCode(val(r, "vlccid")) },
  { key: "rate", header: "Rate", align: "right", get: (r) => val(r, "rtpl", "rate") },
  { key: "amount", header: "Amount", align: "right", get: (r) => val(r, "amount") },
];

interface Draft {
  qty: string;
  fat: string;
  snf: string;
  clr: string;
  milk: string; 
}

const CellInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  label: string;
  autoFocus?: boolean;
}> = ({ value, onChange, label, autoFocus }) => (
  <Input
    type="number"
    inputMode="decimal"
    min="0"
    step="any"
    aria-label={label}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    autoFocus={autoFocus}
    onFocus={(e) => e.currentTarget.select()}
    className="h-9 w-24 min-w-[6rem] px-2.5 text-right text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
  />
);


interface Pending {
  vlc: string;
  shift: string;
  date: string;
  milk: string;
  farmerId: string;
  qty: number;
  fat: number;
  snf: number;
  row: CollectionRow;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const trimId = (s: string) => s.trim().replace(/^0+(?=\d)/, "");
const near = (a: number, b: string) => {
  const n = parseFloat(b);
  return Number.isFinite(n) && Math.abs(n - a) < 0.005;
};
const matches = (p: Pending, r: CollectionRow) =>
  val(r, "vlccid") === p.vlc &&
  trimId(val(r, "farmerid")) === trimId(p.farmerId) &&
  near(p.qty, val(r, "qty")) &&
  near(p.fat, val(r, "fat")) &&
  near(p.snf, val(r, "snf"));

interface Applied {
  vlc: string; 
  ids: string[];
  shift: string;
  milk: string;
  date: string;
}

const FarmerMilkEntry: React.FC = () => {
  const toast = useToast();
  const centers = useCenters();
  const sessionIds = getSession()?.vlccIds ?? [];
  const allIds = centers.length ? centers.map((c) => c.id) : sessionIds;
  const ids = allIds;

  const [vlc, setVlc] = useState(ALL); 
  const [shift, setShift] = useState("M");
  const [milk, setMilk] = useState("C");
  const [date, setDate] = useState(todayISO());
  const [farmerText, setFarmerText] = useState("");
  const [qty, setQty] = useState("");
  const [fat, setFat] = useState("");
  const [snf, setSnf] = useState("");
  const [saving, setSaving] = useState(false);

  const [farmers, setFarmers] = useState<MasterFarmer[]>([]);
  const [farmerState, setFarmerState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [farmerTry, setFarmerTry] = useState(0);

  const [rateRows, setRateRows] = useState<RateRow[] | null>(null);
  const [rateError, setRateError] = useState<string | null>(null);

  
  const [applied, setApplied] = useState<Applied | null>(null);
  const [rows, setRows] = useState<CollectionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [needle, setNeedle] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<CollectionRow | null>(null);
  const stamp = useRef(0);
  const [pending, setPending] = useState<Pending[]>([]);
  const pendingRef = useRef<Pending[]>([]);
  pendingRef.current = pending;

  const isAll = vlc === ALL;
  const entryVlc = isAll ? "" : vlc;

  useEffect(() => {
    setFarmerText("");
    setFarmers([]);
    if (!entryVlc) {
      setFarmerState("ready");
      return;
    }
    let alive = true;
    setFarmerState("loading");
    getFarmers(entryVlc)
      .then((list) => {
        if (!alive) return;
        setFarmers(list);
        setFarmerState("ready");
      })
      .catch(() => {
        if (alive) setFarmerState("error");
      });
    return () => {
      alive = false;
    };
  }, [entryVlc, farmerTry]);

  useEffect(() => {
    setRateRows(null);
    setRateError(null);
    if (!entryVlc) return;
    let alive = true;
    getRateChart(entryVlc)
      .then((r) => {
        if (!alive) return;
        setRateRows(r);
        setRateError(r.length === 0 ? "the chart came back empty." : null);
      })
      .catch((e) => {
        if (!alive) return;
        setRateError(e instanceof ApiError ? e.message : "the request failed.");
      });
    return () => {
      alive = false;
    };
  }, [entryVlc]);

  const farmer = useMemo(() => {
    const t = farmerText.trim().toLowerCase();
    if (!t) return null;
    return (
      farmers.find((f) => farmerLabel(f).toLowerCase() === t) ??
      farmers.find((f) => f.farmerId.toLowerCase() === t) ??
      null
    );
  }, [farmerText, farmers]);

  const qtyN = num(qty);
  const fatN = num(fat);
  const snfN = num(snf);
  const clrN = fatN !== null && snfN !== null ? clrFrom(snfN, fatN) : null;
  const rateN = useMemo(
    () =>
      rateRows && fatN !== null && snfN !== null && clrN !== null
        ? lookupRate(rateRows, {
            fat: fatN,
            snf: snfN,
            clr: clrN,
            milk,
            date,
          })
        : null,
    [rateRows, fatN, snfN, clrN, milk, date],
  );
  const amountN = qtyN !== null && rateN !== null ? r2(qtyN * rateN) : null;

  const valid =
    !!entryVlc &&
    !!date &&
    !!farmer &&
    (qtyN ?? 0) > 0 &&
    fatN !== null &&
    snfN !== null &&
    clrN !== null &&
    rateN !== null &&
    amountN !== null;

  

  const load = useCallback(
    async (silent = false) => {
      if (!applied) return;
      const { ids: aIds, shift: aShift, milk: aMilk, date: aDate } = applied;
      if (!aIds.length || !aDate) return;
      const me = ++stamp.current;
      if (!silent) setLoading(true);
      setError(null);
      setNote(null);
      try {
        const results = await Promise.allSettled(
          aIds.map((id) =>
            getCollection({
              vlccid: id,
              shift: aShift,
              milktype: aMilk,
              fromdate: aDate,
              todate: aDate,
            }),
          ),
        );
        if (me !== stamp.current) return;
        const ok = results.flatMap((r) =>
          r.status === "fulfilled" ? [r.value] : [],
        );
        const failed = results.length - ok.length;
        if (ok.length === 0 && failed > 0) {
          const first = results.find((r) => r.status === "rejected") as
            | PromiseRejectedResult
            | undefined;
          throw (
            first?.reason ??
            new ApiError("The entries could not be loaded.", "server")
          );
        }
        const seen = new Set<string>();
        const merged = ok.flat().filter((r) => {
          const k = idOf(r) || JSON.stringify(r);
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        setRows(merged);
        if (failed > 0)
          setNote(`${failed} of ${results.length} centres could not be loaded.`);
      } catch (e) {
        if (me !== stamp.current) return;
        setRows([]);
        setError(
          e instanceof ApiError
            ? e.message
            : "The entries could not be loaded.",
        );
      } finally {
        if (me === stamp.current) setLoading(false);
      }
    },
    [applied],
  );

  useEffect(() => {
    void load();
  }, [load]);

 
  useEffect(() => {
    setPending((p) =>
      p.some((x) => rows.some((r) => matches(x, r)))
        ? p.filter((x) => !rows.some((r) => matches(x, r)))
        : p,
    );
  }, [rows]);

  const show = () => {
    if (!vlc || !date) return;
    forgetCachedLists(); 
    setEditId(null);
    setDraft(null);
    setApplied({
      vlc,
      ids: vlc === ALL ? ids : [vlc],
      shift,
      milk,
      date,
    });
    setNeedle("");
  };

 

  const clearForm = () => {
    setFarmerText("");
    setQty("");
    setFat("");
    setSnf("");
  };

  const submit = async () => {
    if (!valid || saving || !farmer) return;
    setSaving(true);
    const q = qtyN as number;
    const f = fatN as number;
    const s = snfN as number;
    const c = clrN as number;
    const rt = rateN as number;
    const am = amountN as number;
    const tableIsOnThese =
      !!applied &&
      applied.ids.includes(vlc) &&
      applied.shift === shift &&
      applied.milk === milk &&
      applied.date === date;
    try {
      const message = await postFarmerMilk({
        vlccid: vlc,
        farmerid: farmer.farmerId,
        shift,
        milktype: milk,
        entrydate: date,
        rateid: farmer.rateId || farmer.farmerId,
        qty: String(q),
        fat: String(f),
        snf: String(s),
        clr: String(c),
        rate: String(rt),
        amount: am.toFixed(2),
      });
      toast(message && message.length < 80 ? message : "Milk entry saved");
      forgetCachedLists();
      if (!tableIsOnThese) {
        clearForm();
        return;
      }
      const p: Pending = {
        vlc,
        shift,
        date,
        milk,
        farmerId: farmer.farmerId,
        qty: q,
        fat: f,
        snf: s,
        row: {
          trdate: fmtDate(date),
          shift,
          vlccid: vlc,
          farmerid: farmer.farmerId,
          farmername: farmer.name || "",
          qty: two(q),
          kg: two(q * KG_PER_LITRE),
          fat: two(f),
          snf: two(s),
          clr: two(c),
          milktype: milkName(milk),
          rtpl: two(rt),
          amount: two(am),
        },
      };
      setPending((x) => [...x, p]);
      clearForm();
      await load(true);

      for (let i = 0; i < 5 && pendingRef.current.includes(p); i++) {
        await sleep(1500);
        forgetCachedLists();
        await load(true);
      }
      if (pendingRef.current.includes(p)) {
        setPending((x) => x.filter((y) => y !== p));
        toast(
          "The portal list does not show this entry yet. Press Show to check again.",
          "warn",
        );
      }
    } catch (e) {
      toast(
        e instanceof ApiError ? e.message : "The entry could not be saved",
        "warn",
      );
      if (tableIsOnThese) await load(true);
    } finally {
      setSaving(false);
    }
  };

 

  const shown = useMemo(
    () => [
      ...rows,
      ...pending
        .filter(
          (p) =>
            !!applied &&
            applied.ids.includes(p.vlc) &&
            p.shift === applied.shift &&
            p.milk === applied.milk &&
            p.date === applied.date &&
            !rows.some((r) => matches(p, r)),
        )
        .map((p) => p.row),
    ],
    [rows, pending, applied],
  );

  const visible = useMemo(() => {
    const q = needle.trim().toLowerCase();
    return q
      ? shown.filter((r) =>
          TEXT_COLS.map((c) => c.get(r))
            .join(" ")
            .toLowerCase()
            .includes(q),
        )
      : shown;
  }, [shown, needle]);

  
  const startEdit = (r: CollectionRow) => {
    setEditId(idOf(r));
    setDraft({
      qty: val(r, "qty"),
      fat: val(r, "fat"),
      snf: val(r, "snf"),
      clr: val(r, "clr"),
      milk: milkCode(val(r, "milktype")),
    });
  };
  const cancelEdit = () => {
    setEditId(null);
    setDraft(null);
  };
  const changeDraft = (patch: Partial<Draft>) =>
    setDraft((d) => {
      if (!d) return d;
      const next = { ...d, ...patch };
      if ("fat" in patch || "snf" in patch) {
        const f = num(next.fat);
        const s = num(next.snf);
        if (f !== null && s !== null) next.clr = String(clrFrom(s, f));
      }
      return next;
    });

  const saveEdit = async (r: CollectionRow) => {
    if (!draft || busyId) return;
    const q = num(draft.qty);
    const f = num(draft.fat);
    const s = num(draft.snf);
    const c = num(draft.clr);
    if (q === null || q <= 0 || f === null || s === null || c === null) {
      toast("Enter Liter, Fat and SNF before saving", "warn");
      return;
    }
    const id = idOf(r);
    const d = toIsoDate(val(r, "trdate", "date"));
    if (!id || !d) {
      toast("This entry has no record id, so it cannot be edited", "warn");
      return;
    }
    setBusyId(id);
    try {
      const rate = await updateEntry({
        recordId: id,
        vlccid: val(r, "vlccid"),
        date: d,
        qty: String(q),
        fat: String(f),
        snf: String(s),
        clr: String(c),
        milktype: draft.milk,
      });
      setRows((all) =>
        all.map((x) =>
          idOf(x) === id
            ? {
                ...x,
                qty: two(q),
                Kg: two(q * KG_PER_LITRE),
                fat: two(f),
                snf: two(s),
                clr: two(c),
                milktype: milkName(draft.milk),
                rtpl: two(rate),
                amount: two(q * rate),
              }
            : x,
        ),
      );
      toast("Data updated successfully");
      cancelEdit();
    } catch (e) {
      toast(
        e instanceof ApiError ? e.message : "The entry could not be updated",
        "warn",
      );
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    const r = toDelete;
    if (!r || busyId) return;
    const id = idOf(r);
    setBusyId(id);
    try {
      await deleteEntry({
        recordId: id,
        vlccid: val(r, "vlccid"),
        date: toIsoDate(val(r, "trdate", "date")),
      });
      setRows((all) => all.filter((x) => idOf(x) !== id));
      toast("Entry deleted");
      setToDelete(null);
    } catch (e) {
      toast(
        e instanceof ApiError ? e.message : "The entry could not be deleted",
        "warn",
      );
    } finally {
      setBusyId(null);
    }
  };

  const columns: Column<CollectionRow>[] = useMemo(() => {
    const editing = (r: CollectionRow) =>
      !!draft && !!editId && editId === idOf(r);

    const text: Column<CollectionRow>[] = TEXT_COLS.map((c) => ({
      key: c.key,
      header: c.header,
      align: c.align,
      sort: (r) => {
        const v = c.get(r);
        return v !== "" && Number.isFinite(Number(v)) ? Number(v) : v;
      },
      cell: (r) => {
        if (editing(r) && draft) {
          switch (c.key) {
            case "liter":
              return (
                <CellInput
                  label="Liter"
                  autoFocus
                  value={draft.qty}
                  onChange={(v) => changeDraft({ qty: v })}
                />
              );
            case "fat":
              return (
                <CellInput
                  label="Fat"
                  value={draft.fat}
                  onChange={(v) => changeDraft({ fat: v })}
                />
              );
            case "snf":
              return (
                <CellInput
                  label="Snf"
                  value={draft.snf}
                  onChange={(v) => changeDraft({ snf: v })}
                />
              );
            case "clr":
              return <span className="tnum">{draft.clr || "—"}</span>;
            case "milk":
              return (
                <Select
                  aria-label="Milk type"
                  value={draft.milk}
                  onChange={(e) => changeDraft({ milk: e.target.value })}
                  className="h-9 w-32 min-w-[8rem] text-sm"
                >
                  {MILKS.map((m) => (
                    <option key={m.Id} value={m.Id}>
                      {m.Name}
                    </option>
                  ))}
                </Select>
              );
            case "amount": {
              const q = num(draft.qty);
              const rt = num(val(r, "rtpl", "rate"));
              return q !== null && rt !== null ? two(q * rt) : c.get(r) || "—";
            }
          }
        }
        return c.get(r) || "—";
      },
    }));

    const edit: Column<CollectionRow> = {
      key: "edit",
      header: "Edit",
      align: "center",
      cell: (r) =>
        editing(r) ? (
          <span className="inline-flex items-center gap-1">
            <Button
              size="sm"
              variant="soft"
              aria-label="Save"
              icon={<Check size={14} />}
              loading={busyId === idOf(r)}
              onClick={() => void saveEdit(r)}
            />
            <Button
              size="sm"
              variant="ghost"
              aria-label="Cancel"
              icon={<X size={14} />}
              disabled={busyId === idOf(r)}
              onClick={cancelEdit}
            />
          </span>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            aria-label="Edit entry"
            icon={<Pencil size={14} />}
            disabled={!!editId || !idOf(r)}
            onClick={() => startEdit(r)}
          />
        ),
    };

    const del: Column<CollectionRow> = {
      key: "delete",
      header: "Delete",
      align: "center",
      cell: (r) => (
        <Button
          size="sm"
          variant="danger"
          aria-label="Delete entry"
          icon={<Trash2 size={14} />}
          disabled={!!editId || !idOf(r) || busyId === idOf(r)}
          onClick={() => setToDelete(r)}
        />
      ),
    };

    return [...text, edit, del];
   
  }, [draft, editId, busyId]);

  const exportCols: ExportCol<CollectionRow>[] = useMemo(
    () => TEXT_COLS.map((c) => ({ header: c.header, value: (r) => c.get(r) })),
    [],
  );

 

  const rateHint = rateError
    ? `Rate chart: ${rateError}`
    : rateRows && fatN !== null && snfN !== null && rateN === null
      ? "No rate in the chart for this Fat / SNF."
      : undefined;

  const appliedName = applied
    ? applied.vlc === ALL
      ? GLOBALLABELS.allCentres
      : vlccTitle(applied.vlc)
    : "";

  return (
    <ReportPage title="Farmer Milk Collection">
      <Reveal delay={0.05}>
        <Card>
          <CardHeader
            title={<CardTitle icon={Users}>Farmer Milk Collection</CardTitle>}
            action={
              <Button
                variant="ghost"
                size="sm"
                icon={<RotateCcw size={14} />}
                onClick={clearForm}
              >
                Clear
              </Button>
            }
          />

          <div
            onKeyDown={(e) =>
              handleEnterNext(e, {
                skip: (el) =>
                  el.getAttribute("list") === "farmer-milk-farmers" && !farmer,
                onLast: (root) => (valid ? void submit() : focusFirstEmpty(root)),
              })
            }
          >
            <div className="grid gap-4 px-5 pt-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-3 xl:grid-cols-5">
              <Field label="Date">
                <Input
                  type="date"
                  value={date}
                  max={todayISO()}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
              <Field label="VLC">
                <Select value={vlc} onChange={(e) => setVlc(e.target.value)}>
                  <option value={ALL}>{GLOBALLABELS.allCentres}</option>
                  {ids.map((id) => (
                    <option key={id} value={id}>
                      {vlccOption(id)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Farmer Name">
                <Input
                  list="farmer-milk-farmers"
                  autoComplete="off"
                  disabled={isAll}
                  placeholder={
                    isAll
                      ? "Select a VLC first"
                      : farmerState === "loading"
                        ? "Loading farmers…"
                        : "Select or type farmer"
                  }
                  value={farmerText}
                  onChange={(e) => setFarmerText(e.target.value)}
                  onFocus={() => {
                    if (farmerState === "error") setFarmerTry((n) => n + 1);
                  }}
                />
                <datalist id="farmer-milk-farmers">
                  {farmers.map((f) => (
                    <option key={f.key} value={farmerLabel(f)} />
                  ))}
                </datalist>
              </Field>
              <Field label="Shift">
                <Select value={shift} onChange={(e) => setShift(e.target.value)}>
                  {SHIFTS.map((s) => (
                    <option key={s.Id} value={s.Id}>
                      {s.Name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Milk Type">
                <Select value={milk} onChange={(e) => setMilk(e.target.value)}>
                  {MILKS.map((m) => (
                    <option key={m.Id} value={m.Id}>
                      {m.Name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 sm:p-6 xl:grid-cols-6">
              <Field label="Weight Ltr">
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className={BIG}
                />
              </Field>
              <Field label="Fat">
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={fat}
                  onChange={(e) => setFat(e.target.value)}
                  className={BIG}
                />
              </Field>
              <Field label="SNF">
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={snf}
                  onChange={(e) => setSnf(e.target.value)}
                  className={BIG}
                />
              </Field>
              <Field label="CLR">
                <Input
                  readOnly
                  tabIndex={-1}
                  value={clrN === null ? "" : String(clrN)}
                  className={`bg-soft/60 ${BIG}`}
                />
              </Field>
              <Field label="Rate" hint={rateHint}>
                <Input
                  readOnly
                  tabIndex={-1}
                  value={rateN === null ? "" : String(rateN)}
                  className={`bg-soft/60 ${BIG}`}
                />
              </Field>
              <Field label="Amount">
                <Input
                  readOnly
                  tabIndex={-1}
                  value={amountN === null ? "" : amountN.toFixed(2)}
                  className={`bg-soft/60 ${BIG}`}
                />
              </Field>

              <div className="col-span-2 flex flex-col gap-3 sm:col-span-3 sm:flex-row sm:flex-wrap sm:items-end xl:col-span-6">
                <Button
                  size="lg"
                  className="w-full sm:w-auto sm:min-w-48"
                  icon={<Save size={18} />}
                  loading={saving}
                  disabled={!valid}
                  onClick={submit}
                >
                  Submit
                </Button>
                <Button
                  size="lg"
                  className="w-full sm:w-auto sm:min-w-40"
                  variant="outline"
                  icon={<Eye size={16} />}
                  loading={loading}
                  disabled={!vlc || !date}
                  onClick={show}
                >
                  Show
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </Reveal>

      {applied && (
        <Reveal delay={0.1}>
          <Card>
            <ReportBar
              count={visible.length}
              hideCount={loading || !!error}
              disabled={loading || !!error || visible.length === 0}
              kinds={["xls"]}
              onExport={() =>
                exportExcel(
                  `farmer-milk-entry-${applied.vlc}-${applied.date}-${applied.shift}-${applied.milk}`,
                  exportCols,
                  visible,
                )
              }
              left={
                <div className="w-56 max-w-full">
                  <Input
                    placeholder="Search any column"
                    value={needle}
                    onChange={(e) => setNeedle(e.target.value)}
                  />
                </div>
              }
            />
            {note && !loading && (
              <p className="border-b border-line px-4 py-2 text-xs text-mute sm:px-6">
                {note}
              </p>
            )}
            {loading ? (
              <MilkLoader label="Loading entries…" />
            ) : error ? (
              <ErrorBlock message={error} onRetry={() => void load()} />
            ) : visible.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-mute">
                {shown.length === 0
                  ? `No entry for ${appliedName} on ${fmtDate(applied.date)}.`
                  : "Nothing matches your search."}
              </p>
            ) : (
              <DataTable
                columns={columns}
                rows={visible}
                rowKey={(r) => idOf(r) || JSON.stringify(r)}
                minWidth={1180}
                rowClassName={(r) =>
                  editId && editId === idOf(r) ? "bg-brand/[0.07]" : undefined
                }
                pageSize={DEFAULT_PAGE_SIZE}
                pageSizes={[10, 25, 50, 100, 250]}
                sizeLabel="Result per page"
              />
            )}
          </Card>
        </Reveal>
      )}
      <Modal
        open={!!toDelete}
        onClose={() => (busyId ? undefined : setToDelete(null))}
        title="Delete this entry?"
        subtitle="This cannot be undone."
        width="max-w-md"
        footer={
          <>
            <Button
              variant="ghost"
              disabled={!!busyId}
              onClick={() => setToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              icon={<Trash2 size={16} />}
              loading={!!busyId}
              onClick={() => void confirmDelete()}
            >
              Delete
            </Button>
          </>
        }
      >
        {toDelete && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-mute">Date</dt>
            <dd className="font-semibold">
              {val(toDelete, "trdate", "date") || "—"}
            </dd>
            <dt className="text-mute">Farmer Id</dt>
            <dd className="font-semibold">{val(toDelete, "farmerid") || "—"}</dd>
            <dt className="text-mute">Liter</dt>
            <dd className="font-semibold">{val(toDelete, "qty") || "—"}</dd>
            <dt className="text-mute">Fat / Snf</dt>
            <dd className="font-semibold">
              {val(toDelete, "fat") || "—"} / {val(toDelete, "snf") || "—"}
            </dd>
            <dt className="text-mute">Amount</dt>
            <dd className="font-semibold">{val(toDelete, "amount") || "—"}</dd>
          </dl>
        )}
      </Modal>
      <span className="sr-only">{nf(shown.length)} entries</span>
    </ReportPage>
  );
};

export default FarmerMilkEntry;