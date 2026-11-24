import { dpuGet } from "../http/dpu";
import { DPU } from "../http/dpuEndpoints";
import { pick, pickLike, rowsFrom } from "../utils/loose";
import type { Center } from "../mappers/center.mapper.ts";

const ID_KEYS = [
  "vlccid",
  "vlcid",
  "vlccode",
  "centerid",
  "centreid",
  "villageid",
  "dcsid",
  "dcscode",
  "id",
  "code",
];
const NAME_KEYS = [
  "villagename",
  "vlccname",
  "vlcname",
  "centername",
  "centrename",
  "dcsname",
  "name",
  "village",
];

export const cleanCentreName = (n: string): string =>
  n
    .replace(/\s*\|\s*[\w-]*\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();

const ROUTE_ID_KEYS = [
  "routeid",
  "routecode",
  "routeno",
  "route",
  "routesupervisorid",
  "mccid",
  "plantid",
];
const ROUTE_NAME_KEYS = [
  "routename",
  "routetitle",
  "routedesc",
  "mccname",
  "plantname",
];
const NAME_NOT = [
  "route",
  "mcc",
  "plant",
  "agent",
  "farmer",
  "user",
  "union",
  "society",
  "bank",
  "branch",
  "dairy",
  "file",
  "login",
  "contact",
];
const STATION_KEYS = [
  "customstationid",
  "stationid",
  "stationcode",
  "stationno",
  "station",
];

/** "KANAKUTHUR   |   SMS25" -> "SMS25" (the custom station id is the text after the last "|" of Customvillagename) */
const customFromName = (n: string): string => {
  const i = n.lastIndexOf("|");
  return i < 0 ? "" : n.slice(i + 1).trim();
};

export function parseCenters(json: unknown): Center[] {
  const out: Center[] = [];
  for (const row of rowsFrom(json)) {
    const id = pick(row, ID_KEYS);
    if (!id || out.some((c) => c.id === id)) continue;

    const name = cleanCentreName(
      pick(row, NAME_KEYS) || pickLike(row, ["name"], NAME_NOT),
    );
    out.push({
      id,
      name,
      label: name || id,
      routeId: pick(row, ROUTE_ID_KEYS) || undefined,
      routeName: pick(row, ROUTE_NAME_KEYS) || undefined,
      stationId:
        pick(row, STATION_KEYS) ||
        customFromName(pick(row, ["customvillagename"])) ||
        undefined,
      raw: row,
    });
  }
  return out;
}

export const getDpuCenter = (
  id: string,
  param: "id" | "stationid" | "userid" | "mccid" = "id",
): Promise<unknown> =>
  dpuGet(`${DPU.farmerCollectionDpu}?${param}=${encodeURIComponent(id)}`, 0);

/** Centres of one station id (used when the person signs in). */
export const getCenter = (id: string): Promise<unknown> => getDpuCenter(id);
