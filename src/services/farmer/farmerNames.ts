import { fetchDpuFarmerMaster } from "./farmer.api.ts";

const TTL_MS = 5 * 60_000;

interface Entry {
  at: number;
  names: Map<string, string>;
}

const names = new Map<string, Entry>();
/** names saved in this browser: they win over the server list for a while (the server may still answer with the old name) */
const OVERRIDE_MS = 10 * 60_000;
const overrides = new Map<string, { name: string; at: number }>();
const okey = (vlccid: string, farmerId: string | number) =>
  `${String(vlccid)}:${plainId(String(farmerId))}`;
const asked = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();
let version = 0;

export const plainId = (id: string): string => {
  const t = String(id ?? "").trim();
  return /^\d+$/.test(t) ? String(Number(t)) : t.toLowerCase();
};

/** true when the name the server sent is missing or only repeats the farmer id */
export const nameIsMissing = (raw: string, farmerId: string): boolean => {
  const n = String(raw ?? "").trim();
  return !n || plainId(n) === plainId(farmerId) || /^farmer\s*#/i.test(n);
};

const bump = () => {
  version += 1;
  listeners.forEach((l) => l());
};

export const farmerNamesVersion = (): number => version;

/** React: useSyncExternalStore(subscribeFarmerNames, farmerNamesVersion) */
export function subscribeFarmerNames(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** current Master name of a farmer, or "" when the Master was not loaded / has no name */
export function masterNameOf(vlccid: string, farmerId: string): string {
  const o = overrides.get(okey(vlccid, farmerId));
  if (o && Date.now() - o.at < OVERRIDE_MS) return o.name;
  return names.get(String(vlccid))?.names.get(plainId(farmerId)) ?? "";
}

const stale = (vlccid: string): boolean => {
  const e = names.get(vlccid);
  return !e || Date.now() - e.at > TTL_MS;
};

export async function ensureMasterNames(vlccids: string[]): Promise<void> {
  const need = [
    ...new Set(vlccids.map((v) => String(v).trim()).filter(Boolean)),
  ].filter(stale);
  if (!need.length) return;
  await Promise.all(
    need.map((id) => {
      let p = asked.get(id);
      if (!p) {
        p = fetchDpuFarmerMaster(id)
          .then((list) => {
            const m = new Map<string, string>();
            for (const f of list) {
              const n = f.name.trim();
              if (n && !nameIsMissing(n, f.farmerId))
                m.set(plainId(f.farmerId), n);
            }
            if (m.size) {
              names.set(id, { at: Date.now(), names: m });
              bump();
            }
          })
          .catch(() => {
            /* keep the old names; the next report load tries again */
          })
          .finally(() => {
            asked.delete(id);
          });
        asked.set(id, p);
      }
      return p;
    }),
  );
}

export function setMasterName(
  vlccid: string,
  farmerId: string | number,
  name: string,
): void {
  const id = String(vlccid);
  const e = names.get(id) ?? { at: 0, names: new Map<string, string>() };
  const n = name.trim();
  if (n) {
    e.names.set(plainId(String(farmerId)), n);
    overrides.set(okey(id, farmerId), { name: n, at: Date.now() });
  } else {
    e.names.delete(plainId(String(farmerId)));
    overrides.delete(okey(id, farmerId));
  }
  e.at = 0; // forces a re-read from the server on the next report load
  names.set(id, e);
  bump();
}

/** Farmer Master changed (import / delete / status): forget the names of one centre, or of all */
export function invalidateFarmerNames(vlccid?: string): void {
  if (vlccid === undefined) names.clear();
  else names.delete(String(vlccid));
  bump();
}
