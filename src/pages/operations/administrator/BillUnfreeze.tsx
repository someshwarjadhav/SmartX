import type * as React from "react";
import { useMemo, useState } from "react";
import { LockOpen, Search, Snowflake } from "lucide-react";
import { Card, CardHeader } from "../../../components/operations/ui/Card";
import { Button } from "../../../components/operations/ui/Button";
import { Field, Select } from "../../../components/operations/ui/Fields";
import {
  DataTable,
  type Column,
} from "../../../components/operations/ui/DataTable";
import { Modal } from "../../../components/operations/ui/Modal";
import { MilkLoader } from "../../../components/operations/MilkLoader";
import {
  CardTitle,
  ReportBar,
  ReportPage,
  Reveal,
} from "../../../components/operations/ReportKit";
import { ErrorBlock } from "../../../components/operations/Widget";
import { useCentreOptions } from "../../../hooks/useCentres";
import { vlccCode } from "../../../services/vlcc/names";
import { useToast } from "../../../context/ToastContext";
import {
  FREEZE_FIELDS,
  getBillFreezes,
  unfreezeBill,
} from "../../../services/administrator/billFreeze.api";
import { ApiError } from "../../../services/http/errors";
import { pick, type Obj } from "../../../services/utils/loose";

interface Row {
  raw: Obj;
  key: string;
  id: string;
  villageId: string;
  villageName: string;
  start: string;
  end: string;
}


const showDate = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
};
const dateKey = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}${m[2]}${m[3]}`;
  const d = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
  return d ? `${d[3]}${d[2]}${d[1]}` : s;
};

const toRows = (list: Obj[]): Row[] =>
  list.map((raw, n) => {
    const id = pick(raw, FREEZE_FIELDS.id);
    return {
      raw,
      key: `${id || "row"}-${n}`,
      id,
      villageId: pick(raw, FREEZE_FIELDS.villageId),
      villageName: pick(raw, FREEZE_FIELDS.villageName),
      start: pick(raw, FREEZE_FIELDS.start),
      end: pick(raw, FREEZE_FIELDS.end),
    };
  });

const BillUnfreeze: React.FC = () => {
  const options = useCentreOptions();
  const toast = useToast();

  const [picked, setPicked] = useState("");
  const vlc = picked || options[0]?.id || "";

  const [applied, setApplied] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [toUnfreeze, setToUnfreeze] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async (villageId: string) => {
    setLoading(true);
    setError(null);
    try {
      const list = toRows(await getBillFreezes(villageId));
      setRows(list);
      return list;
    } catch (e) {
      setRows([]);
      setError(
        e instanceof ApiError
          ? e.message
          : "The frozen bills could not be loaded.",
      );
      return null;
    } finally {
      setLoading(false);
    }
  };

  const show = async () => {
    if (loading || !vlc) return;
    setApplied(vlc);
    await load(vlc);
  };

  const confirmUnfreeze = async () => {
    const row = toUnfreeze;
    if (!row || busy || !applied) return;
    setBusy(true);
    try {
      await unfreezeBill(row.raw, applied);
      const list = await load(applied);
      // The list is the proof: if the bill is still in it, the server did not lift the freeze.
      if (list?.some((r) => r.id === row.id && r.start === row.start)) {
        toast(
          `Bill ${row.id || ""} is still frozen. The server did not accept the request.`,
          "warn",
        );
      } else {
        toast("Bill unfrozen successfully");
      }
      setToUnfreeze(null);
    } catch (e) {
      toast(
        e instanceof ApiError ? e.message : "The bill could not be unfrozen",
        "warn",
      );
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<Row>[] = useMemo(
    () => [
      {
        key: "id",
        header: "Unfreeze No.",
        sort: (r) => Number(r.id) || r.id,
        cell: (r) => r.id || "—",
      },
      {
        key: "villageId",
        header: "Village Id",
        sort: (r) => vlccCode(r.villageId),
        cell: (r) => vlccCode(r.villageId) || "—",
      },
      {
        key: "villageName",
        header: "Village Name",
        sort: (r) => r.villageName,
        cell: (r) => r.villageName || "—",
      },
      {
        key: "start",
        header: "Start Date",
        sort: (r) => dateKey(r.start),
        cell: (r) => showDate(r.start) || "—",
      },
      {
        key: "end",
        header: "End Date",
        sort: (r) => dateKey(r.end),
        cell: (r) => showDate(r.end) || "—",
      },
      {
        key: "action",
        header: "Action",
        cell: (r) => (
          <Button
            size="sm"
            icon={<LockOpen size={14} />}
            disabled={busy}
            onClick={() => setToUnfreeze(r)}
          >
            UnFreeze
          </Button>
        ),
      },
    ],
    [busy],
  );

  return (
    <ReportPage
      title="Bill Unfreeze"
      subtitle="Choose the VLC, press Show, then unfreeze the bill you need."
    >
      <Reveal delay={0.05}>
        <Card>
          <CardHeader
            title={<CardTitle icon={Snowflake}>Freeze Info</CardTitle>}
          />
          <div className="grid gap-4 p-5 sm:p-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Field label="VLC Name">
              <Select
                value={vlc}
                onChange={(e) => setPicked(e.target.value)}
                disabled={options.length === 0}
              >
                {options.length === 0 && <option value="">Loading VLCs…</option>}
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-end">
              <Button
                className="w-full"
                icon={<Search size={16} />}
                loading={loading && !busy}
                disabled={!vlc}
                onClick={() => void show()}
              >
                Show
              </Button>
            </div>
          </div>
        </Card>
      </Reveal>

      {/* Always on screen: empty (headers only) until Show is pressed */}
      <Reveal delay={0.1}>
        <Card>
          <ReportBar
            count={applied ? rows.length : 0}
            hideCount={loading}
            disabled
            kinds={[]}
            onExport={() => undefined}
          />
          {loading ? (
            <MilkLoader label="Loading frozen bills…" />
          ) : error ? (
            <ErrorBlock message={error} onRetry={() => void show()} />
          ) : (
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(r) => r.key}
              minWidth={760}
              empty={
                <p className="px-6 py-10 text-center text-sm text-mute">
                  {applied
                    ? "No frozen bill for this VLC."
                    : "Choose a VLC and press Show to see its frozen bills."}
                </p>
              }
            />
          )}
        </Card>
      </Reveal>

      <Modal
        open={!!toUnfreeze}
        onClose={() => (busy ? undefined : setToUnfreeze(null))}
        title="Unfreeze this bill?"
        subtitle="The bill for these dates will open for changes again."
        width="max-w-md"
        footer={
          <>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => setToUnfreeze(null)}
            >
              Cancel
            </Button>
            <Button
              icon={<LockOpen size={16} />}
              loading={busy}
              onClick={() => void confirmUnfreeze()}
            >
              UnFreeze
            </Button>
          </>
        }
      >
        {toUnfreeze && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-mute">Unfreeze No.</dt>
            <dd className="font-semibold">{toUnfreeze.id || "—"}</dd>
            <dt className="text-mute">Village</dt>
            <dd className="break-words font-semibold">
              {toUnfreeze.villageName || "—"} ({vlccCode(toUnfreeze.villageId) || "—"})
            </dd>
            <dt className="text-mute">Start Date</dt>
            <dd className="font-semibold">{showDate(toUnfreeze.start) || "—"}</dd>
            <dt className="text-mute">End Date</dt>
            <dd className="font-semibold">{showDate(toUnfreeze.end) || "—"}</dd>
          </dl>
        )}
      </Modal>
    </ReportPage>
  );
};

export default BillUnfreeze;
