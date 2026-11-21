/**
 * RECEIPT VOUCHER  (money received from a farmer, Flag = R, TransactionFlag = C)
 * Its own paths, its own payload (AccountNo, no deduction type) and its own
 * body formats. Nothing here is shared with the payment voucher except the
 * low-level transport.
 */
import { clearRequestMemo } from "../http/client";
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
import {
  deleteVoucherById,
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
    // The backend class has ONLY string properties: a JSON number cannot be bound and ends in "Please check data."
    FarmerMasterCode: String(toNumber(v.farmerCode || v.farmerId)),
    EntryDate: apiDate(v.date),
    Amount: String(toNumber(v.amount)),
    DeductionType: "0",
    PaymentMode: String(modeNumber(v.paymentMode, v.ledgerType)),
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

export async function deleteReceiptVoucher(
  id: string,
  vlcid?: string,
  date?: string,
): Promise<string> {
  const num = /^\d+$/.test(id) ? Number(id) : id;
  const row = { ...(RAW_ROWS.get(id) ?? {}), Id: num, StationId: vlcid ?? "" };
  const message = await deleteVoucherById({
    key: "ReceiptVoucher",
    deletePath: RECEIPT_DELETE_PATH,
    savePath: SAVE_PATH,
    id,
    row,
    ...(vlcid && date
      ? {
          stillThere: async () =>
            (await getReceiptVouchers(vlcid, date)).some((r) => r.id === id),
        }
      : {}),
  });
  clearRequestMemo();
  return message;
}
