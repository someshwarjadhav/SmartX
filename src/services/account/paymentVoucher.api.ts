/**
 * PAYMENT VOUCHER  (money paid to a farmer, Flag = P, TransactionFlag = D)
 * Its own paths, its own payload and its own body formats. Nothing here is
 * shared with the receipt voucher except the low-level transport.
 */
import { clearRequestMemo } from "../http/client";
import { dpuGet } from "../http/dpu";
import { DPU } from "../http/dpuEndpoints";
import { apiDate } from "../utils/date";
import { norm, rowsFrom, type Obj } from "../utils/loose";
import {
  ledgerOptions,
  toNumber,
  toOption,
  toRow,
  unique,
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

export const PAYMENT_LEDGER_PATH = DPU.getAccountLedger;
export const PAYMENT_BILL_HEAD_PATH = DPU.getBillHead;
export const PAYMENT_SAVE_PATH = DPU.paymentVoucher;
export const PAYMENT_LIST_PATH = DPU.paymentVoucherList;
export const PAYMENT_DELETE_PATH = DPU.paymentVoucherDelete;

// The old working portal save (first voucher of a day, no rows to learn from) sent Flag "PY" / TransactionFlag "DR".
const FLAG = "PY";
const TRANSACTION_FLAG = "DR";

const stationOf = (vlcid: string): string =>
  getSession()?.stationByVlcc?.[vlcid] || vlcid;

/** PaymentMode as the portal sends it: 1 = Bank, 2 = Cash (the ledger's AccountType). */
const modeNumber = (mode: string, ledgerType?: string): number =>
  ledgerType === "1" || ledgerType === "2"
    ? Number(ledgerType)
    : mode.trim().toLowerCase() === "cash"
      ? 2
      : 1;

function learnFlags(): { flag: string; txn: string } {
  for (const r of RAW_ROWS.values()) {
    if ((deductionOf(r) ?? 0) === 0) continue;
    const get = (name: string): string => {
      const k = Object.keys(r).find((x) => norm(x) === name);
      return k === undefined || r[k] == null ? "" : String(r[k]).trim();
    };
    const flag = get("flag");
    const txn = get("transactionflag");
    if (flag && txn) return { flag, txn };
  }
  return { flag: FLAG, txn: TRANSACTION_FLAG };
}

const SAVE_PATH = PAYMENT_SAVE_PATH;

export interface PaymentVoucherInput {
  vlcid: string;
  farmerId: string;
  date: string;
  amount: string;
  deductionType: string;
  paymentMode: string;
  ledgerId: string;
  narration: string;
  /** Farmer number the portal sends as FarmerMasterCode. */
  farmerCode?: string;
  /** AccountType of the chosen ledger (1 = bank, 2 = cash). */
  ledgerType?: string;
}

export async function getLedgers(): Promise<VoucherOption[]> {
  return ledgerOptions(rowsFrom(await readDpuPath(PAYMENT_LEDGER_PATH)));
}

/** The portal has a single deduction type for payment vouchers: Advance (5000). */
const ADVANCE: VoucherOption = { value: "5000", label: "Advance" };

export async function getDeductionTypes(
  vlcid: string,
): Promise<VoucherOption[]> {
  try {
    const rows = rowsFrom(
      await dpuGet(
        `${PAYMENT_BILL_HEAD_PATH}?stationid=${encodeURIComponent(vlcid)}`,
        0,
      ),
    );
    const all = unique(
      rows
        .map((r) =>
          toOption(
            r,
            [
              "headid",
              "billheadid",
              "deductiontypeid",
              "deductionid",
              "id",
              "code",
            ],
            [
              "headname",
              "billheadname",
              "deductionname",
              "deductiontype",
              "name",
              "description",
            ],
          ),
        )
        .filter((o): o is VoucherOption => !!o),
    );
    const advance = all.find(
      (o) => /advance/i.test(o.label) || o.value === ADVANCE.value,
    );
    return [advance ?? ADVANCE];
  } catch {
    return [ADVANCE];
  }
}

/** DeductionType of a server row (0 for receipts, e.g. 5000 = Advance for payments). */
/** Raw server rows by Id: the portal's delete wants the whole row, like Sale Entry does. */
const RAW_ROWS = new Map<string, Obj>();

const deductionOf = (r: Obj): number | null => {
  const k = Object.keys(r).find((x) => norm(x) === "deductiontype");
  if (k === undefined) return null;
  const n = Number(r[k]);
  return Number.isFinite(n) ? n : null;
};

export async function getPaymentVouchers(
  vlcid: string,
  date: string,
): Promise<VoucherRow[]> {
  const raw = rowsFrom(
    await readVoucherList("PaymentVoucherList", PAYMENT_LIST_PATH, {
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
  const headOf = (r: Obj): string => {
    const k = Object.keys(r).find((x) => norm(x) === "headname");
    return k === undefined || r[k] == null ? "" : String(r[k]).trim();
  };
  // Like the live portal: Code = DeductionType (e.g. 5000), Name = HeadName (e.g. Advance).
  const rows = mine.map((r, i) => ({
    ...toRow(r, i),
    date: toRow(r, i).date || date,
    code: String(deductionOf(r) ?? ""),
    name: headOf(r),
  }));
  return rows;
}

export async function savePaymentVoucher(
  v: PaymentVoucherInput,
): Promise<string> {
  const learned = learnFlags();
  const fields = {
    StationId: stationOf(v.vlcid),
    FarmerId: String(v.farmerId),
    // The backend class PaymentVoucher has ONLY string properties: a JSON number (3, 100, 1) cannot be bound to
    // a string and ends in "Please check data.", so every value is sent as text.
    FarmerMasterCode: String(toNumber(v.farmerCode || v.farmerId)),
    EntryDate: apiDate(v.date),
    Amount: String(toNumber(v.amount)),
    DeductionType: String(v.deductionType),
    PaymentMode: String(modeNumber(v.paymentMode, v.ledgerType)),
    Flag: learned.flag,
    TransactionFlag: learned.txn,
    Narration: v.narration.trim() || "0",
  };
  const message = await saveVoucherPayload(
    SAVE_PATH,
    fields,
    async () => (await getPaymentVouchers(v.vlcid, v.date)).length,
    "PaymentVoucher",
  );
  clearRequestMemo();
  return message;
}

export async function deletePaymentVoucher(
  id: string,
  vlcid?: string,
  date?: string,
): Promise<string> {
  const num = /^\d+$/.test(id) ? Number(id) : id;
  const row = { ...(RAW_ROWS.get(id) ?? {}), Id: num, StationId: vlcid ?? "" };
  const message = await deleteVoucherById({
    key: "PaymentVoucher",
    deletePath: PAYMENT_DELETE_PATH,
    savePath: SAVE_PATH,
    id,
    row,
    ...(vlcid && date
      ? {
          stillThere: async () =>
            (await getPaymentVouchers(vlcid, date)).some((r) => r.id === id),
        }
      : {}),
  });
  clearRequestMemo();
  return message;
}