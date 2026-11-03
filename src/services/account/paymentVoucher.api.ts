import { checkReply } from "../master/farmerMaster.api";
import { apiDate } from "../utils/date";
import { rowsFrom } from "../utils/loose";
import {
  ledgerOptions,
  onlyVoucherKind,
  toNumber,
  toOption,
  toRow,
  unique,
  type VoucherOption,
  type VoucherRow,
} from "./voucher.common";
import { postVoucher, readPath, sendPath } from "./voucher.http";

export const PAYMENT_LEDGER_PATH = "/dairy/dairy/getaccountledger";
export const PAYMENT_BILL_HEAD_PATH = "/dairy/dairy/getbillhead";
export const PAYMENT_SAVE_PATH = "/dairy/dairy/paymentvoucher";
export const PAYMENT_LIST_PATH = "/dairy/dairy/paymentvoucherlist";
export const PAYMENT_DELETE_PATH = "/dairy/dairy/paymentvoucherdelete";

const FLAG = "P";
const TRANSACTION_FLAG = "D";

export interface PaymentVoucherInput {
  vlcid: string;
  farmerId: string;
  date: string;
  amount: string;
  deductionType: string;
  paymentMode: string;
  ledgerId: string;
  narration: string;
}

export async function getLedgers(): Promise<VoucherOption[]> {
  return ledgerOptions(rowsFrom(await readPath(PAYMENT_LEDGER_PATH)));
}

export async function getDeductionTypes(
  vlcid: string,
): Promise<VoucherOption[]> {
  const rows = rowsFrom(
    await readPath(
      `${PAYMENT_BILL_HEAD_PATH}?stationid=${encodeURIComponent(vlcid)}`,
    ),
  );
  return unique(
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
}

export async function getPaymentVouchers(
  vlcid: string,
  date: string,
): Promise<VoucherRow[]> {
  const qs = `stationid=${encodeURIComponent(vlcid)}&date=${encodeURIComponent(apiDate(date))}`;
  const rows = rowsFrom(await readPath(`${PAYMENT_LIST_PATH}?${qs}`));
  return onlyVoucherKind(rows.map(toRow), FLAG);
}

export async function savePaymentVoucher(
  v: PaymentVoucherInput,
): Promise<string> {
  const fields = {
    StationId: v.vlcid,
    FarmerId: v.farmerId,
    FarmerMasterCode: v.farmerId,
    EntryDate: apiDate(v.date),
    Amount: toNumber(v.amount),
    DeductionType: v.deductionType,
    PaymentMode: v.paymentMode,
    Flag: FLAG,
    TransactionFlag: TRANSACTION_FLAG,
    Narration: v.narration.trim(),
    LedgerId: v.ledgerId,
  };
  const text = await postVoucher(
    PAYMENT_SAVE_PATH,
    fields,
    async () => (await getPaymentVouchers(v.vlcid, v.date)).length,
  );
  return checkReply(text, "The payment voucher could not be saved.", true);
}

export async function deletePaymentVoucher(id: string): Promise<string> {
  const text = await sendPath(
    `${PAYMENT_DELETE_PATH}?id=${encodeURIComponent(id)}`,
    () => ({ method: "GET" }),
  );
  return checkReply(text, "The payment voucher could not be deleted.", true);
}
