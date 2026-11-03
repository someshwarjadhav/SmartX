import { checkReply } from "../master/farmerMaster.api";
import { apiDate } from "../utils/date";
import { rowsFrom } from "../utils/loose";
import {
  ledgerOptions,
  onlyVoucherKind,
  toNumber,
  toRow,
  type VoucherOption,
  type VoucherRow,
} from "./voucher.common";
import { postVoucher, readPath, sendPath } from "./voucher.http";

export const RECEIPT_LEDGER_PATH = "/dairy/dairy/getaccountledger";
export const RECEIPT_SAVE_PATH = "/dairy/dairy/paymentvoucher";
export const RECEIPT_LIST_PATH = "/dairy/dairy/paymentvoucherlist";
export const RECEIPT_DELETE_PATH = "/dairy/dairy/paymentvoucherdelete";

const FLAG = "R";
const TRANSACTION_FLAG = "C";

export interface ReceiptVoucherInput {
  vlcid: string;
  farmerId: string;
  date: string;
  amount: string;
  paymentMode: string;
  ledgerId: string;
  accountNo: string;
  narration: string;
}

export async function getLedgers(): Promise<VoucherOption[]> {
  return ledgerOptions(rowsFrom(await readPath(RECEIPT_LEDGER_PATH)));
}

export async function getReceiptVouchers(
  vlcid: string,
  date: string,
): Promise<VoucherRow[]> {
  const qs = `stationid=${encodeURIComponent(vlcid)}&date=${encodeURIComponent(apiDate(date))}`;
  const rows = rowsFrom(await readPath(`${RECEIPT_LIST_PATH}?${qs}`));
  return onlyVoucherKind(rows.map(toRow), FLAG);
}

export async function saveReceiptVoucher(
  v: ReceiptVoucherInput,
): Promise<string> {
  const fields = {
    StationId: v.vlcid,
    FarmerId: v.farmerId,
    FarmerMasterCode: v.farmerId,
    EntryDate: apiDate(v.date),
    Amount: toNumber(v.amount),
    DeductionType: "",
    PaymentMode: v.paymentMode,
    Flag: FLAG,
    TransactionFlag: TRANSACTION_FLAG,
    Narration: v.narration.trim(),
    LedgerId: v.ledgerId,
    AccountNo: v.accountNo.trim(),
  };
  const text = await postVoucher(
    RECEIPT_SAVE_PATH,
    fields,
    async () => (await getReceiptVouchers(v.vlcid, v.date)).length,
  );
  return checkReply(text, "The receipt voucher could not be saved.", true);
}

export async function deleteReceiptVoucher(id: string): Promise<string> {
  const text = await sendPath(
    `${RECEIPT_DELETE_PATH}?id=${encodeURIComponent(id)}`,
    () => ({ method: "GET" }),
  );
  return checkReply(text, "The receipt voucher could not be deleted.", true);
}
