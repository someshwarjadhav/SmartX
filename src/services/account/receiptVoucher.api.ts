/**
 * RECEIPT VOUCHER  (money received from a farmer, Flag = R, TransactionFlag = C)
 * Its own paths, its own payload (AccountNo, no deduction type) and its own
 * body formats. Nothing here is shared with the payment voucher except the
 * low-level transport.
 */
import { clearRequestMemo } from "../http/client";
import { dpuSaveAttempts } from "../http/dpu";
import { DPU } from "../http/dpuEndpoints";
import { apiDate } from "../utils/date";
import { norm, rowsFrom, type Obj } from "../utils/loose";
import {
  ledgerOptions,
  toNumber,
  toRow,
  type VoucherOption,
  type VoucherRow,
} from "./voucher.common";
import { ApiError } from "../http/errors";
import {
  payloadBody,
  readDpuPath,
  readVoucherList,
  saveVoucherPayload,
} from "./voucher.http";
import { getSession } from "../session";

export const RECEIPT_LEDGER_PATH = DPU.getAccountLedger;
export const RECEIPT_SAVE_PATH = DPU.paymentVoucher;
export const RECEIPT_LIST_PATH = DPU.paymentVoucherList;
export const RECEIPT_DELETE_PATH = DPU.paymentVoucherDelete;

/** Live portal values for a receipt (decoded from its save request). */
const FLAG = "RC";
const TRANSACTION_FLAG = "CR";

const stationOf = (vlcid: string): string =>
  getSession()?.stationByVlcc?.[vlcid] || vlcid;

/** PaymentMode as the portal sends it: 1 = Bank, 2 = Cash (the ledger's AccountType). */
const modeNumber = (mode: string, ledgerType?: string): number =>
  ledgerType === "1" || ledgerType === "2"
    ? Number(ledgerType)
    : mode.trim().toLowerCase() === "cash"
      ? 2
      : 1;

const SAVE_PATH = RECEIPT_SAVE_PATH;

export interface ReceiptVoucherInput {
  vlcid: string;
  farmerId: string;
  date: string;
  amount: string;
  paymentMode: string;
  ledgerId: string;
  accountNo: string;
  narration: string;
  /** Farmer number the portal sends as FarmerMasterCode. */
  farmerCode?: string;
  /** AccountType of the chosen ledger (1 = bank, 2 = cash). */
  ledgerType?: string;
}

export async function getLedgers(): Promise<VoucherOption[]> {
  return ledgerOptions(rowsFrom(await readDpuPath(RECEIPT_LEDGER_PATH)));
}

/** Raw server rows by Id: the portal's delete wants the whole row, like Sale Entry does. */
const RAW_ROWS = new Map<string, Obj>();

export async function getReceiptVouchers(
  vlcid: string,
  date: string,
): Promise<VoucherRow[]> {
  const raw = rowsFrom(
    await readVoucherList("ReceiptVoucherList", RECEIPT_LIST_PATH, {
      stationid: String(vlcid),
      date: apiDate(date),
    }),
  );
  for (const r of raw) {
    const k = Object.keys(r).find((x) => norm(x) === "id");
    if (k !== undefined && r[k] != null) RAW_ROWS.set(String(r[k]), r);
  }
  // Like the live portal: the list shows every voucher of the day, nothing is filtered out.
  const mine = raw;
  const rows = mine.map((r, i) => {
    const row = toRow(r, i);
    return { ...row, date: row.date || date, name: row.farmerName || row.name };
  });
  return rows;
}

export async function saveReceiptVoucher(
  v: ReceiptVoucherInput,
): Promise<string> {
  // Exactly what the live portal encrypts and posts (no LedgerId / AccountNo).
  const fields = {
    StationId: stationOf(v.vlcid),
    FarmerId: String(v.farmerId),
    FarmerMasterCode: toNumber(v.farmerCode || v.farmerId),
    EntryDate: apiDate(v.date),
    Amount: toNumber(v.amount),
    DeductionType: "0",
    PaymentMode: modeNumber(v.paymentMode, v.ledgerType),
    Flag: FLAG,
    TransactionFlag: TRANSACTION_FLAG,
    Narration: v.narration.trim() || "0",
  };
  const message = await saveVoucherPayload(
    SAVE_PATH,
    fields,
    async () => (await getReceiptVouchers(v.vlcid, v.date)).length,
    "ReceiptVoucher",
  );
  clearRequestMemo();
  return message;
}

const DELETE_KEY = "smartx.receiptVoucher.deleteFormat";
const rememberedDelete = (): string => {
  try {
    return localStorage.getItem(DELETE_KEY) ?? "";
  } catch {
    return "";
  }
};
const rememberDelete = (n: string): void => {
  try {
    localStorage.setItem(DELETE_KEY, n);
  } catch {
    /* ignore */
  }
};

interface DeleteTry {
  name: string;
  path: string;
  body: { payload: string };
}

/**
 * Delete, then CHECK the list: the voucher counts as deleted only when the
 * server really stopped returning it. Formats are tried until one works, and
 * the one that worked is remembered.
 */
export async function deleteReceiptVoucher(
  id: string,
  vlcid?: string,
  date?: string,
): Promise<string> {
  const num = /^\d+$/.test(id) ? Number(id) : id;
  const row = { ...(RAW_ROWS.get(id) ?? {}), Id: num, StationId: vlcid ?? "" };
  const path = `${RECEIPT_DELETE_PATH}?id=${encodeURIComponent(id)}`;
  // DELETE with { payload: "<XOR + base64>" } (like DeleteFarmer); the id also stays in the URL
  const tries: DeleteTry[] = [
    { name: "payload-id", path, body: payloadBody({ id: String(id) }) },
    { name: "payload-row", path, body: payloadBody(row) },
    { name: "payload-id-pascal", path, body: payloadBody({ Id: num }) },
  ];
  const known = rememberedDelete();
  const order = [
    ...tries.filter((t) => t.name === known),
    ...tries.filter((t) => t.name !== known),
  ];
  const stillThere = async (): Promise<boolean> =>
    !!vlcid && !!date && (await getReceiptVouchers(vlcid, date)).some((r) => r.id === id);

  const failed: string[] = [];
  for (const t of order) {
    try {
      const message = await dpuSaveAttempts(
        `ReceiptVoucherDelete:${t.name}`,
        [{ label: t.name, path: t.path, body: t.body }],
        "DELETE",
      );
      clearRequestMemo();
      if (!vlcid || !date) return message || "Deleted";
      if (!(await stillThere())) {
        rememberDelete(t.name);
        console.info(`[ReceiptVoucher] deleted using: ${t.name}`);
        return "Deleted";
      }
      failed.push(`${t.name} (no effect)`);
    } catch (e) {
      if (e instanceof ApiError && e.kind === "auth") throw e;
      failed.push(t.name);
      console.warn(`[ReceiptVoucher] delete failed with ${t.name}:`, e);
    }
  }
  throw new ApiError(
    `The server did not delete voucher ${id} (tried: ${failed.join(", ")}).`,
    "server",
  );
}
