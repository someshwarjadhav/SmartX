import type * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, RotateCcw, Save, Milk } from "lucide-react";
import { Card, CardHeader } from "../../../components/operations/ui/Card";
import { Button } from "../../../components/operations/ui/Button";
import { Field, Input, Select } from "../../../components/operations/ui/Fields";
import {
  DataTable,
  type Column,
} from "../../../components/operations/ui/DataTable";
import { MilkLoader } from "../../../components/operations/MilkLoader";
import {
  CardTitle,
  ReportBar,
  ReportPage,
  Reveal,
} from "../../../components/operations/ReportKit";
import { ErrorBlock } from "../../../components/operations/Widget";
import {
  exportExcel,
  type ExportCol,
} from "../../../assets/excel/portalExport";
import { useToast } from "../../../context/ToastContext";
import { fmtDate, nf, todayISO } from "../../../lib/portal/format";
import { DEFAULT_PAGE_SIZE, GLOBALSSHIFT } from "../../../lib/portal/global";
import { useCenters } from "../../../hooks/useSessionData";
import { usePlantScope } from "../../../hooks/usePlantScope";
import { PlantSelectField } from "../../../components/operations/ReportFilters";
import { getSession } from "../../../services/session";
import { vlccOption, vlccTitle } from "../../../services/vlcc/names";
import {
  getVlcMilk,
  postVlcMilk,
  type VlcMilkRow,
} from "../../../services/transaction/vlcMilk.api.ts";
import { ApiError } from "../../../services/http/errors";
import { norm } from "../../../services/utils/loose";
import { focusFirstEmpty, handleEnterNext } from "../../../hooks/useEnterNext";


const BIG = "!h-20 !text-center !text-2xl !font-semibold sm:!text-3xl";

const SHIFTS = GLOBALSSHIFT.shiftOptions.filter(
  (s) => s.Id === "M" || s.Id === "E",
);
const MILKS = [
  { Id: "C", Name: "Cow" },
  { Id: "B", Name: "Buffalo" },
  { Id: "M", Name: "Mix" },
];

const val = (r: VlcMilkRow, ...keys: string[]): string => {
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

const num = (s: string) => {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};
const r1 = (n: number) => Math.round(n * 10) / 10;

const clrFrom = (snf: number, fat: number) => r1((snf - 0.21 * fat - 0.36) * 4);

const COLS: Array<{
  key: string;
  header: string;
  align?: "right";
  get: (r: VlcMilkRow) => string;
}> = [
  {
    key: "date",
    header: "Date",
    get: (r) => val(r, "trdate", "entrydate", "dsdtdate", "date", "dtdate"),
  },
  {
    key: "vlc",
    header: "VLC Name",
    get: (r) =>
      val(r, "villagename", "vlcname", "vlcc name", "name") ||
      vlccTitle(val(r, "vlccid", "vlcid", "id")),
  },
  {
    key: "liter",
    header: "Liter",
    align: "right",
    get: (r) => val(r, "qty", "liter", "ltr", "weight", "weightltr"),
  },
  {
    key: "kg",
    header: "kg",
    align: "right",
    get: (r) => val(r, "kg", "weightkg"),
  },
  { key: "fat", header: "Fat", align: "right", get: (r) => val(r, "fat") },
  { key: "snf", header: "SNF", align: "right", get: (r) => val(r, "snf") },
  { key: "clr", header: "CLR", align: "right", get: (r) => val(r, "clr") },
  { key: "milk", header: "Milk Type", get: (r) => val(r, "milktype", "milk") },
  { key: "shift", header: "Shift", get: (r) => val(r, "shift") },
  {
    key: "rate",
    header: "Rate",
    align: "right",
    get: (r) => val(r, "rate", "rtpl"),
  },
  {
    key: "amount",
    header: "Amount",
    align: "right",
    get: (r) => val(r, "amount"),
  },
];

interface Pending {
  vlc: string;
  shift: string;
  date: string;
  qty: number;
  fat: number;
  snf: number;
  clr: number;
  milk: string;
  row: VlcMilkRow;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const same = (a: number, b: string) =>
  num(b) !== null && Math.abs((num(b) as number) - a) < 0.005;
const sameMilk = (a: string, b: string) => {
  const x = norm(a);
  const y = norm(b);
  return !!x && !!y && (x === y || x.startsWith(y) || y.startsWith(x));
};
const matches = (p: Pending, r: VlcMilkRow) =>
  same(p.qty, val(r, "qty", "liter", "ltr", "weight")) &&
  same(p.fat, val(r, "fat")) &&
  same(p.snf, val(r, "snf")) &&
  same(p.clr, val(r, "clr")) &&
  sameMilk(val(r, "milktype", "milk"), p.milk);

const sortValue = (s: string): number | string =>
  s !== "" && Number.isFinite(Number(s)) ? Number(s) : s;

const VlcMilkEntry: React.FC = () => {
  const toast = useToast();
  const centers = useCenters();
  const sessionIds = getSession()?.vlccIds ?? [];
  const allIds = centers.length ? centers.map((c) => c.id) : sessionIds;
  
  const { plantOptions, plant, setPlant, belongs } = usePlantScope();
  const ids = allIds.filter((id) => belongs(id));

  const [vlc, setVlc] = useState(ALL);
  const [shift, setShift] = useState("M");
  const [milk, setMilk] = useState("C");
  const [date, setDate] = useState(todayISO());
  const [qty, setQty] = useState("");
  const [fat, setFat] = useState("");
  const [snf, setSnf] = useState("");
  const [clr, setClr] = useState("");

  const [applied, setApplied] = useState<{
    vlc: string;
    shift: string;
    date: string;
    targets: string[];
  } | null>(null);

 
  const [byVlc, setByVlc] = useState<Record<string, VlcMilkRow[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [needle, setNeedle] = useState("");
  const stamp = useRef(0);
  const [pending, setPending] = useState<Pending[]>([]);
  const pendingRef = useRef<Pending[]>([]);
  pendingRef.current = pending;

  const rows = useMemo(
    () => (applied ? applied.targets.flatMap((id) => byVlc[id] ?? []) : []),
    [applied, byVlc],
  );
  const covers = (a: { vlc: string; targets: string[] }, id: string) =>
    a.vlc === ALL ? a.targets.includes(id) : a.vlc === id;

  const changePlant = (p: string) => {
    setPlant(p);
    const list = allIds.filter((id) => belongs(id, p));
  
    if (vlc !== ALL && list.length && !list.includes(vlc)) setVlc(list[0]);
  };

  const load = useCallback(
    async (silent = false, only?: string) => {
      if (!applied) return;
      const { vlc: aVlc, shift: aShift, date: aDate, targets } = applied;
      if (!aVlc || !aDate) return;
      const list = only ? [only] : targets;
      if (!list.length) return;
      const me = ++stamp.current;
      if (!silent) setLoading(true);
      setError(null);
      if (!only) setNote(null);
      try {
        const results = await Promise.allSettled(
          list.map((id) => getVlcMilk(id, aShift, aDate)),
        );
        if (me !== stamp.current) return;
        const failed = results.filter((r) => r.status === "rejected").length;
        if (failed === results.length) {
          const first = results.find(
            (r) => r.status === "rejected",
          ) as PromiseRejectedResult;
          throw first.reason;
        }
        const next: Record<string, VlcMilkRow[]> = {};
        list.forEach((id, i) => {
          const r = results[i];
          
          if (r.status === "fulfilled")
            next[id] = r.value.map((row) => ({ vlccid: id, ...row }));
        });
        setByVlc((prev) => (only ? { ...prev, ...next } : next));
        if (!only && failed > 0)
          setNote(`${failed} of ${list.length} centres could not be loaded.`);
      } catch (e) {
        if (me !== stamp.current) return;
      
        if (only) return;
        setByVlc({});
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

  const onFat = (v: string) => {
    setFat(v);
    const f = num(v);
    const s = num(snf);
    if (f !== null && s !== null) setClr(String(clrFrom(s, f)));
    else setClr("");
  };
  const onSnf = (v: string) => {
    setSnf(v);
    const s = num(v);
    const f = num(fat);
    if (s !== null && f !== null) setClr(String(clrFrom(s, f)));
    else setClr("");
  };

  const valid =
    !!vlc &&
    vlc !== ALL &&
    !!date &&
    [qty, fat, snf, clr].every((x) => num(x) !== null) &&
    (num(qty) ?? 0) > 0;

  const clearForm = () => {
    setQty("");
    setFat("");
    setSnf("");
    setClr("");
  };

  const submit = async () => {
    if (!valid || saving) return;
    setSaving(true);
    const q = num(qty) as number;
    const entry = {
      vlccid: vlc,
      shift,
      milktype: milk,
      entrydate: date,
      qty: String(q),
      fat: String(num(fat)),
      snf: String(num(snf)),
      clr: String(num(clr)),
    };
    const tableIsOnThese =
      !!applied &&
      covers(applied, vlc) &&
      applied.shift === shift &&
      applied.date === date;
    const milkName = MILKS.find((m) => m.Id === milk)?.Name ?? milk;
    const shiftName = SHIFTS.find((x) => x.Id === shift)?.Name ?? shift;
    try {
      const message = await postVlcMilk(entry);
      toast(message && message.length < 80 ? message : "Milk entry saved");
      if (!tableIsOnThese) {
        clearForm();
        return;
      }
      const p: Pending = {
        vlc,
        shift,
        date,
        qty: q,
        fat: num(fat) as number,
        snf: num(snf) as number,
        clr: num(clr) as number,
        milk: milkName,
        row: {
          trdate: fmtDate(date),
          villagename: vlccTitle(vlc),
          qty: String(q),
          kg: (q * 1.03).toFixed(2),
          fat,
          snf,
          clr,
          milktype: milkName,
          shift: shiftName,
          rate: "0",
          amount: "0",
        },
      };
      setPending((x) => [...x, p]);
      clearForm();
      await load(true, vlc);

      for (let i = 0; i < 5 && pendingRef.current.includes(p); i++) {
        await sleep(1500);
        await load(true, vlc);
      }
      if (pendingRef.current.includes(p)) {
        setPending((x) => x.filter((y) => y !== p));
        toast(
          "The portal list does not show this entry. It may have updated the existing entry of this milk type.",
          "warn",
        );
      }
    } catch (e) {
      toast(
        e instanceof ApiError ? e.message : "The entry could not be saved",
        "warn",
      );
      if (tableIsOnThese) await load(true, vlc);
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
            covers(applied, p.vlc) &&
            p.shift === applied.shift &&
            p.date === applied.date &&
            !rows.some((r) => matches(p, r)),
        )
        .map((p) => p.row),
    ],
    [rows, pending, applied],
  );

  const visible = useMemo(() => {
    const s = needle.trim().toLowerCase();
    return s
      ? shown.filter((r) =>
          COLS.map((c) => c.get(r))
            .join(" ")
            .toLowerCase()
            .includes(s),
        )
      : shown;
  }, [shown, needle]);

  const columns: Column<VlcMilkRow>[] = useMemo(
    () =>
      COLS.map((c) => ({
        key: c.key,
        header: c.header,
        align: c.align,
        sort: (r) => sortValue(c.get(r)),
        cell: (r) => c.get(r) || "—",
      })),
    [],
  );
  const exportCols: ExportCol<VlcMilkRow>[] = useMemo(
    () => COLS.map((c) => ({ header: c.header, value: (r) => c.get(r) })),
    [],
  );

  return (
    <ReportPage title="VLC Milk Entry">
      <Reveal delay={0.05}>
        <Card>
          <CardHeader
            title={<CardTitle icon={Milk}>VLC Milk Collection</CardTitle>}
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
                onLast: (root) =>
                  valid ? void submit() : focusFirstEmpty(root),
              })
            }
          >
          <div className="grid gap-4 px-5 pt-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-3 xl:grid-cols-5">
            <PlantSelectField
              value={plant}
              onChange={changePlant}
              options={plantOptions}
            />
            <Field label="VLC">
              <Select value={vlc} onChange={(e) => setVlc(e.target.value)}>
                <option value={ALL}>All</option>
                {ids.map((id) => (
                  <option key={id} value={id}>
                    {vlccOption(id)}
                  </option>
                ))}
              </Select>
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
            <Field label="Date">
              <Input
                type="date"
                value={date}
                max={todayISO()}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4 sm:p-6">
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
                onChange={(e) => onFat(e.target.value)}
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
                onChange={(e) => onSnf(e.target.value)}
                className={BIG}
              />
            </Field>
            <Field label="CLR">
              <Input
                readOnly
                tabIndex={-1}
                value={clr}
                className={`bg-soft/60 ${BIG}`}
              />
            </Field>

            <div className="col-span-2 flex flex-col gap-3 sm:col-span-4 sm:flex-row sm:flex-wrap sm:items-end">
              <Button
                className="w-full sm:w-auto sm:min-w-48"
                icon={<Save size={16} />}
                loading={saving}
                disabled={!valid}
                onClick={submit}
              >
                Submit
              </Button>
              <Button
                className="w-full sm:w-auto sm:min-w-40"
                variant="outline"
                icon={<Eye size={16} />}
                loading={loading}
                disabled={!vlc || !date || (vlc === ALL && ids.length === 0)}
                onClick={() =>
                  setApplied({
                    vlc,
                    shift,
                    date,
                    targets: vlc === ALL ? [...ids] : [vlc],
                  })
                }
              >
                Show
              </Button>
              {vlc === ALL && (
                <p className="text-xs text-mute sm:self-center">
                  Select a VLC to enter milk. All is for viewing only.
                </p>
              )}
            </div>
          </div>
          </div>
        </Card>
      </Reveal>

      <Reveal delay={0.1}>
        <Card>
          <ReportBar
            count={visible.length}
            hideCount={loading || !!error}
            disabled={loading || !!error || visible.length === 0}
            kinds={["xls"]}
            onExport={() =>
              applied &&
              exportExcel(
                `vlc-milk-entry-${applied.vlc}-${applied.date}-${applied.shift}`,
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
          ) : (
            <DataTable
              columns={columns}
              rows={visible}
              rowKey={(r) => JSON.stringify(r)}
              pageSize={DEFAULT_PAGE_SIZE}
              pageSizes={[10, 25, 50, 100, 250]}
              sizeLabel="Result per page"
              empty={
                <p className="px-6 py-10 text-center text-sm text-mute">
                  {!applied
                    ? "No data. Click Show to load entries."
                    : shown.length === 0
                      ? applied.vlc === ALL
                        ? `No entry for any VLC on ${fmtDate(applied.date)}.`
                        : `No entry for ${vlccTitle(applied.vlc)} on ${fmtDate(applied.date)}.`
                      : "Nothing matches your search."}
                </p>
              }
            />
          )}
        </Card>
      </Reveal>
      <span className="sr-only">{nf(shown.length)} entries</span>
    </ReportPage>
  );
};

export default VlcMilkEntry;