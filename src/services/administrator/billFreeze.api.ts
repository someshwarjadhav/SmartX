import { clearRequestMemo } from "../http/client";
import {
  dpuReadAttempts,
  dpuSaveAttempts,
  encryptedShapes,
  type SaveAttempt,
} from "../http/dpu";
import { DPU } from "../http/dpuEndpoints";
import { ApiError } from "../http/errors";
import { isObj, pick, rowsFrom, type Obj } from "../utils/loose";

const PATH = DPU.getMilkBillFreeze;

export const FREEZE_FIELDS = {
  id: ["autorownum", "unfreezeno", "unfreezenumber", "freezeno", "id"],
  villageId: ["villageid", "vlccid", "vlcid", "stationid"],
  villageName: ["villagename", "vlccname", "vlcname", "name"],
  start: ["startdate", "fromdate", "start"],
  end: ["enddate", "todate", "end"],
};

const layouts = (o: Partial<Record<string, string>>): SaveAttempt[] => {
  const text = {
    AutoRowNum: "0",
    VillageId: "",
    EntryDate: "",
    StartDate: "",
    EndDate: "",
    flag: "0",
    ...o,
  };
  const numbers = {
    ...text,
    AutoRowNum: Number(text.AutoRowNum) || 0,
    flag: Number(text.flag) || 0,
    json: "",
  };
  const attempts: SaveAttempt[] = [
    { label: "json", path: PATH, body: numbers },
    { label: "json-text", path: PATH, body: { ...text, json: "" } },
  ];
  try {
    for (const body of encryptedShapes(numbers))
      attempts.push({ label: "payload", path: PATH, body });
  } catch {
    /* no encryption key configured: only the plain bodies are tried */
  }
  return attempts;
};

function listFrom(json: unknown): Obj[] {
  if (isObj(json)) {
    const ok = json.Success ?? json.success;
    if (ok === false) {
      const message = String(json.Message ?? json.message ?? "").trim();
      if (!message || /no\s*record/i.test(message)) return [];
      throw new ApiError(message, "server");
    }
  }
  return rowsFrom(json);
}

export async function getBillFreezes(villageId: string): Promise<Obj[]> {
  clearRequestMemo();
  return dpuReadAttempts(
    "BillFreezeList",
    layouts({ VillageId: villageId }),
    listFrom,
  );
}

export async function unfreezeBill(row: Obj, villageId: string): Promise<void> {
  await dpuSaveAttempts(
    "BillUnfreeze",
    layouts({
      AutoRowNum: pick(row, FREEZE_FIELDS.id),
      VillageId: pick(row, FREEZE_FIELDS.villageId) || villageId,
      EntryDate: "",
      StartDate: "",
      EndDate: "",
      flag: "2",
    }),
  );
  clearRequestMemo();
}
