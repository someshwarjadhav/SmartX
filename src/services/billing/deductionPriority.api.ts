import { GLOBALS } from "../../lib/portal/global";
import { ApiError } from "../http/errors";
import { listHeads, type DeductionHead } from "../master/deductionMaster.api";

/**
 * Deduction Priority (menu: Billing > Deduction Priority).
 *
 * When a farmer's bill is made (milk amount for the 10 days), the deductions are cut from it one after another. If the
 * bill is not enough for all of them, the ones on top of this list are cut first and the ones at the bottom last.
 * The list is every head of Deduction Master; the saved order is just the list of codes, top to bottom.
 *
 * STORE: same as Deduction Master - kept per plant in this browser until the DPU endpoint is known. Only
 * getPriorityList / savePriority touch the store.
 */

const scope = () => String(GLOBALS.plantid || GLOBALS.mccid || "default");
export const PRIORITY_KEY = () => `smartx.deductionPriority.${scope()}`;

function readOrder(): string[] {
  try {
    const raw = localStorage.getItem(PRIORITY_KEY());
    const v: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.map((x) => String(x)) : [];
  } catch {
    return [];
  }
}

/** Saved order first; heads that have no place yet (new ones) go to the bottom in code order; deleted heads vanish. */
export function applyOrder(
  heads: DeductionHead[],
  order: string[],
): DeductionHead[] {
  const byCode = new Map(heads.map((h) => [h.code, h]));
  const placed = order
    .map((c) => byCode.get(c))
    .filter((h): h is DeductionHead => !!h);
  const have = new Set(placed.map((h) => h.code));
  return [...placed, ...heads.filter((h) => !have.has(h.code))];
}

export async function getPriorityList(): Promise<DeductionHead[]> {
  return applyOrder(await listHeads(), readOrder());
}

export async function savePriority(codes: string[]): Promise<void> {
  if (!codes.length)
    throw new ApiError("There is no deduction to save.", "config");
  try {
    localStorage.setItem(PRIORITY_KEY(), JSON.stringify(codes));
  } catch {
    throw new ApiError(
      "The priority could not be saved in this browser (storage is full or blocked).",
      "server",
    );
  }
}

/** One step up (-1) or down (+1); returns the same array when the row is already at the edge. */
export function moveRow<T>(rows: T[], index: number, step: -1 | 1): T[] {
  const to = index + step;
  if (index < 0 || index >= rows.length || to < 0 || to >= rows.length)
    return rows;
  const next = rows.slice();
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}
