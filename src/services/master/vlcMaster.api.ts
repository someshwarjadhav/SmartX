import { clearRequestMemo, listOf } from "../http/client";
import { dpuGet, dpuSaveAttempts, type SaveAttempt } from "../http/dpu";
import { ApiError, isEmptyReply } from "../http/errors";
import { encryptXorPayload } from "../../lib/portal/crypto";
import { isObj, norm, pick, type Obj } from "../utils/loose";
import { unwrapReply } from "./farmerMaster.api.ts";
import { getSession } from "../session";

const P = {
  route: "/Login/getMccRoute",
  max: "/Login/getMaxVlcc",
  create: "/Login/createVillage",
  update: "/Login/updateVillage",
  list: "/Login/getVillageDetails",
  one: "/Login/getVillageId",
};
const PUT_VILLAGE_URL = "https://smartx.shivinfotech.co.in/home/PutVillage";

export interface VlcRoute {
  routeId: string;
  routeName: string;
}

export interface VlcSlots {
  startId: string;
  endId: string;
  allocated: string;
  used: string;
  available: string;
  nextVillageId: string;
}

export interface VlcRecord {
  key: string;
  villageId: string;
  displayId: string;
  customId: string;
  villageName: string;
  agentName: string;
  contact: string;
  address: string;
  active: boolean;
  pcbNo: string;
  ekoPass: string;
  type: string;
  routeId: string;
  rateId: string;
  dpuId: string;
  beneficiary: string;
}

export interface VlcInput {
  villageId: string;

  beneficiary: string;
  customerId: string;
  villageName: string;
  type: string;
  active: boolean;
  agentName: string;
  contact: string;
  pcbNo: string;
  currentPass: string;
  newPass: string;
  passApply: boolean;
}

export const emptyVlc = (nextId = ""): VlcInput => ({
  villageId: nextId,
  beneficiary: "",
  customerId: "",
  villageName: "",
  type: "Cooperative Society",
  active: true,
  agentName: "",
  contact: "",
  pcbNo: "",
  currentPass: "",
  newPass: "",
  passApply: false,
});

export const VLC_TYPES = ["Cooperative Society", "Private", "Individual"];

const q = encodeURIComponent;

async function orNone<T>(
  call: () => Promise<unknown>,
  onData: (json: unknown) => T,
  none: T,
): Promise<T> {
  let json: unknown;
  try {
    json = await call();
  } catch (e) {
    if (isEmptyReply(e)) return none;
    throw e;
  }
  return onData(json);
}

const asObj = (json: unknown): Obj => {
  const j = unwrapReply(json);
  if (Array.isArray(j)) return (j.find(isObj) as Obj | undefined) ?? {};
  if (isObj(j)) {
    const inner = j.Data ?? j.data;
    if (isObj(inner)) return inner;
    if (Array.isArray(inner))
      return (inner.find(isObj) as Obj | undefined) ?? {};
    return j;
  }
  return {};
};

const rowsOf = (json: unknown): Obj[] => {
  try {
    return listOf<Obj>(json).filter(isObj);
  } catch (e) {
    if (e instanceof ApiError && e.kind === "parse") return [];
    throw e;
  }
};

export async function getMccRoute(
  mccid: string,
  plantid: string,
): Promise<VlcRoute[]> {
  return orNone<VlcRoute[]>(
    () => dpuGet(`${P.route}?mccid=${q(mccid)}&plantid=${q(plantid)}`, 0),
    (json) =>
      rowsOf(json)
        .map((r) => ({
          routeId: pick(r, ["routeid", "id"]),
          routeName: pick(r, ["routename", "name"]),
        }))
        .filter((r) => r.routeId),
    [],
  );
}

const num = (v: string) => (v !== "" && Number.isFinite(Number(v)) ? Number(v) : NaN);

function slotValue(o: Obj, exact: string[], like: string[], not: string[] = []) {
  const keys = Object.keys(o);
  for (const w of exact) {
    const k = keys.find((x) => norm(x) === w);
    if (k === undefined) continue;
    const v = o[k];
    if ((typeof v === "string" && v.trim()) || typeof v === "number")
      return String(v).trim();
  }
  for (const k of keys) {
    const n = norm(k);
    if (!like.some((l) => n.includes(l)) || not.some((x) => n.includes(x)))
      continue;
    const v = o[k];
    if ((typeof v === "string" && v.trim()) || typeof v === "number")
      return String(v).trim();
  }
  return "";
}

export async function getMaxVlcc(
  mccid: string,
  plantid: string,
): Promise<VlcSlots | null> {
  const json = await orNone<unknown>(
    () => dpuGet(`${P.max}?mccid=${q(mccid)}&plantid=${q(plantid)}`, 0),
    (j) => j,
    null,
  );
  const un = unwrapReply(json);
  let o = asObj(json);
  let scalarNext = "";
  if (typeof un === "number" && Number.isFinite(un)) scalarNext = String(un);
  else if (typeof un === "string" && /^\d{3,}$/.test(un.trim())) scalarNext = un.trim();
  if (scalarNext) o = { nextvillageid: scalarNext };
  const out: VlcSlots = {
    startId: slotValue(o, ["startid", "startstationid", "fromid"], ["start"]),
    endId: slotValue(o, ["endid", "endstationid", "toid"], ["end"]),
    allocated: slotValue(
      o,
      ["allocatedslots", "allocatedstationid", "allocated", "totalslots", "total"],
      ["alloc", "total"],
    ),
    used: slotValue(
      o,
      ["usedslots", "usedstationid", "used"],
      ["used", "occupied"],
    ),
    available: slotValue(
      o,
      ["availableslots", "availablestationid", "available", "freeslots"],
      ["avail", "free", "remain", "balance"],
    ),
    nextVillageId: slotValue(
      o,
      ["nextvillageid", "nextvlccid", "nextvlcid", "nextstationid", "maxvillageid", "maxvlccid"],
      ["next"],
    ),
  };

  let allocated = num(out.allocated);
  const used = num(out.used);
  let available = num(out.available);
  const start = num(out.startId);
  const end = num(out.endId);
  if (Number.isNaN(allocated) && !Number.isNaN(start) && !Number.isNaN(end) && end >= start)
    allocated = end - start + 1;
  if (Number.isNaN(allocated) && !Number.isNaN(used) && !Number.isNaN(available))
    allocated = used + available;
  if (Number.isNaN(available) && !Number.isNaN(allocated) && !Number.isNaN(used))
    available = Math.max(allocated - used, 0);
  if (!Number.isNaN(allocated)) out.allocated = String(allocated);
  if (!Number.isNaN(available)) out.available = String(available);

  return Object.values(out).some(Boolean) ? out : null;
}

export function nextIdFromRows(rows: Array<{ villageId: string }>): string {
  const ids = rows
    .map((r) => r.villageId.trim())
    .filter((v) => /^\d{5,}$/.test(v))
    .map(Number);
  return ids.length ? String(Math.max(...ids) + 1) : "";
}

const INACTIVE = /^(0|false|n|no|closed|(in|de)[\s_-]?active(d)?)$/i;
const flag = (v: string) => !INACTIVE.test(v.trim());

function mapVillage(r: Obj, i: number, routeId: string): VlcRecord {
  const villageId = pick(r, ["villageid", "vlccid", "vlcid"]);
  const status = pick(r, ["villagestatus", "status", "isactive"]);
  const ses = getSession();

  const customId =
    pick(r, ["customstationid", "customvillageid"]) ||
    ses?.stationByVlcc?.[villageId] ||
    "";
  const displayId = customId || pick(r, ["stationid"]) || villageId;
  const villageName =
    pick(r, ["villageagentaddress"]) ||
    ses?.vlccNames?.[villageId] ||
    pick(r, ["villagename", "vlcname", "name"]);
  const rawAgent = pick(r, ["villageagentname", "agentname"]);
  const agentName = rawAgent && rawAgent !== villageId ? rawAgent : "";

  return {
    key: `${villageId || "x"}:${i}`,
    villageId,
    displayId,
    customId: customId && customId !== villageId ? customId : "",
    villageName,
    agentName,
    contact: pick(r, ["villageagentcontact", "contact", "mobile"]),
    address: pick(r, ["villageagentaddress", "address"]),
    active: status === "" ? true : flag(status),
    pcbNo: pick(r, ["pcbsrno", "ekopcbno", "pcbno", "pcbserialno"]),
    ekoPass: pick(r, ["ekopass", "euppass"]),
    type: pick(r, ["type", "vlctype"]),
    routeId: pick(r, ["routeid"]) || routeId,
    rateId: pick(r, ["villagerateid", "rateid"]),
    dpuId: pick(r, ["dpuid"]),
    beneficiary: pick(r, ["beneficiaryname"]),
  };
}

export async function getVillageDetails(
  mccid: string,
  routeid: string,
): Promise<VlcRecord[]> {
  const forms = [routeid, ` ${routeid}`, "0", ""];
  let firstError: unknown = null;
  for (const r of forms) {
    try {
      const rows = await orNone<VlcRecord[]>(
        () => dpuGet(`${P.list}?mccid=${q(mccid)}&routeid=${q(r)}`, 0),
        (json) => {
          const un = unwrapReply(json);

          if (typeof un === "string" && un.trim() && !/no\s*record/i.test(un))
            throw new ApiError(un.trim(), "server");
          return rowsOf(json).map((x, i) => mapVillage(x, i, routeid));
        },
        [],
      );
      if (rows.length) return rows;
    } catch (e) {
      if (r === routeid && firstError === null) firstError = e;
    }
  }
  if (firstError) throw firstError;
  return [];
}

export async function getVillageById(
  villageid: string,
): Promise<VlcRecord | null> {
  const json = await orNone<unknown>(
    () => dpuGet(`${P.one}?villageid=${q(villageid)}`, 0),
    (j) => j,
    null,
  );
  const o = asObj(json);
  return Object.keys(o).length ? mapVillage(o, 0, "") : null;
}

export async function findFreeVillageId(
  start: string,
  end: string,
): Promise<string> {
  const first = Number(start);
  if (!Number.isFinite(first) || first <= 0) return start;
  const last = Number(end) > first ? Number(end) : first + 40;
  for (let id = first, tries = 0; id <= last && tries < 40; id++, tries++) {
    const found = await getVillageById(String(id)).catch(() => null);
    if (!found || found.villageId !== String(id)) return String(id);
  }
  return "";
}

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function toPayload(
  f: VlcInput,
  ctx: { mccid: string; routeid: string; userId: string; rateId?: string },
) {
  const today = new Date();
  const close = new Date(today);
  close.setFullYear(today.getFullYear() + 1);
  const name = f.villageName.trim();
  return {
    villageid: f.villageId.trim(),

    beneficiaryname:
      f.beneficiary.trim() || f.customerId.trim() || f.villageId.trim(),
    villagename: name,
    villageagentname: f.agentName.trim(),
    villageagentaddress: name,
    villageagentcontact: f.contact.trim(),
    routeid: ctx.routeid,
    mccid: ctx.mccid,
    villageopendate: ymd(today),
    villageclosedate: ymd(close),
    villagestatus: f.active ? "1" : "0",
    villagerateid: ctx.rateId || "0",
    createdby: ctx.userId || "web",
    createddate: ymd(today),
    type: f.type,
    dpuId: "0",
    ekopcbno: f.pcbNo.trim(),
    ekopass: f.currentPass,
    ekonewpass: f.newPass || (f.passApply ? "" : "000000"),
    ekopassflag: f.passApply ? "1" : "0",
  };
}

type Ctx = Parameters<typeof toPayload>[1];

function attempts(path: string, row: Record<string, unknown>): SaveAttempt[] {
  return [
    { label: "xor-object", path, body: { payload: encryptXorPayload(row) } },
    { label: "plain-object", path, body: row },
    { label: "xor-array", path, body: { payload: encryptXorPayload([row]) } },
  ];
}

export async function createVillage(f: VlcInput, ctx: Ctx): Promise<string> {
  const msg = await dpuSaveAttempts(
    "createVillage",
    attempts(P.create, toPayload(f, ctx)),
    "POST",
  );
  clearRequestMemo();
  return msg;
}

export async function updateVillage(f: VlcInput, ctx: Ctx): Promise<string> {
  const msg = await dpuSaveAttempts(
    "updateVillage",
    attempts(P.update, toPayload(f, ctx)),
    "PUT",
  );
  clearRequestMemo();
  return msg;
}

export async function putVillageStations(
  stationIds: string[],
  customStationIds: string[],
  loginId: string,
): Promise<void> {
  if (!stationIds.length) return;
  const url =
    `${PUT_VILLAGE_URL}?request=${q(stationIds.join(","))}` +
    `&customstationid=${q(customStationIds.join(","))}` +
    `&loginId=${q(loginId)}`;
  const res = await fetch(url, { method: "GET" }).catch(() => {
    throw new ApiError("Cannot reach the server. Check your connection and try again.", "network");
  });
  const text = (await res.text().catch(() => "")).trim();
  if (!res.ok)
    throw new ApiError(
      `The customer id could not be linked (error ${res.status}).`,
      "server",
    );
  if (/"success"\s*:\s*false/i.test(text))
    throw new ApiError(
      text.replace(/<[^>]*>/g, " ").slice(0, 160) ||
        "The customer id could not be linked.",
      "server",
    );
  clearRequestMemo();
}

export const assertConfigured = (mccid: string, plantid: string) => {
  if (!mccid || !plantid)
    throw new ApiError(
      "MCC id / Plant id is missing in your login record. Please sign in again.",
      "config",
    );
};