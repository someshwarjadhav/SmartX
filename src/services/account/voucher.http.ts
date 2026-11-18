import { BASE_URL } from "../config";
import { directGet, gatewayGet, gatewayText, listOf } from "../http/client";
import { dpuGet, dpuSave, dpuSaveAttempts, dpuWrite } from "../http/dpu";
import { ApiError, EmptyReplyError } from "../http/errors";
import { getSession } from "../session";
import { encryptPayload, encryptXorPayload } from "../../lib/portal/crypto";

const gatewayRoot = (): string => {
  const root = BASE_URL || "https://smartx.shivinfotech.co.in";
  return /^https?:/i.test(root) ? root : `${window.location.origin}${root}`;
};

const viaGateway = (path: string): string =>
  `${gatewayRoot()}/gateway/Interceptor?path=${path}`;

export async function readPath(path: string): Promise<unknown> {
  try {
    return await directGet(viaGateway(path), 0);
  } catch (first) {
    if (first instanceof EmptyReplyError) return [];
    if (first instanceof ApiError && first.kind === "auth") throw first;
    try {
      return await gatewayGet(path, 0);
    } catch (second) {
      if (second instanceof EmptyReplyError) return [];
      throw first;
    }
  }
}

/** GET on the DPU API (https://dpu.shivinfotech.co.in/api/Login/<name>). An empty reply means an empty list. */
export async function readDpuPath(path: string): Promise<unknown> {
  try {
    return await dpuGet(path, 0);
  } catch (e) {
    if (e instanceof EmptyReplyError) return [];
    throw e;
  }
}

export const payloadBody = (value: unknown): { payload: string } => ({
  payload: encryptXorPayload(value),
});

const errText = (e: unknown): string =>
  (e instanceof Error ? e.message : String(e))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);

const authHeaders = (): Record<string, string> => {
  const token = getSession()?.token;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const REMEMBER = "smartx.voucher.format.";
const remembered = (key: string): string => {
  try {
    return localStorage.getItem(REMEMBER + key) ?? "";
  } catch {
    return "";
  }
};
const remember = (key: string, name: string): void => {
  try {
    localStorage.setItem(REMEMBER + key, name);
  } catch {
    /* ignore */
  }
};
const preferFirst = <T extends { name: string }>(
  key: string,
  list: T[],
): T[] => {
  const known = remembered(key);
  return [
    ...list.filter((t) => t.name === known),
    ...list.filter((t) => t.name !== known),
  ];
};

interface ListTry {
  name: string;
  run: () => Promise<unknown>;
}

export async function readVoucherList(
  key: string,
  path: string,
  params: Record<string, string>,
): Promise<Array<Record<string, unknown>>> {
  const url = `${path}?${new URLSearchParams(params).toString()}`;
  const post = (name: string, body: unknown): ListTry => ({
    name,
    run: () =>
      dpuWrite(
        url,
        { method: "POST", headers: authHeaders(), body: JSON.stringify(body) },
        1,
      ),
  });

  const tries: ListTry[] = preferFirst(key, [
    post("post-payload-params", { payload: encryptXorPayload(params) }),
    post("post-payload-array", { payload: encryptXorPayload([params]) }),
    post("post-json", params),
    { name: "get-query", run: () => dpuGet(url, 1, undefined, true) },
  ]);
  const failed: string[] = [];
  let lastAuth: unknown = null;
  for (const t of tries) {
    try {
      const rows = listOf<Record<string, unknown>>(await t.run());
      remember(key, t.name);
      return rows;
    } catch (e) {
      if (e instanceof EmptyReplyError) return [];
      if (e instanceof ApiError && /empty reply/i.test(e.message)) return [];
      if (e instanceof ApiError && e.kind === "auth") lastAuth = e;
      failed.push(`${t.name}: ${errText(e)}`);
    }
  }
  if (lastAuth) throw lastAuth;
  throw new ApiError(
    `The voucher list could not be read (${failed.join(" | ")}).`,
    "server",
  );
}

/**
 * Save a voucher: ONE POST whose body is { payload } = the voucher JSON, XOR + base64. If a failed attempt still
 * stored the row, the day's count grows and the save is treated as done - a retry can never create a duplicate.
 */
export async function saveVoucherPayload(
  path: string,
  fields: VoucherFields,
  count: () => Promise<number>,
  label: string,
): Promise<string> {
  let before = -1;
  try {
    before = await count();
  } catch {
    before = -1;
  }
  try {
    const message = await dpuSaveAttempts(
      `${label}Save`,
      [
        { label: "payload-params", path, body: payloadBody(fields) },
        {
          label: "payload-aes-params",
          path,
          body: { payload: encryptPayload(fields) },
        },
        {
          label: "payload-aes-array",
          path,
          body: { payload: encryptPayload([fields]) },
        },
        {
          label: "Payload-aes-params",
          path,
          body: { Payload: encryptPayload(fields) },
        },

        {
          label: "payload-data-text",
          path,
          body: payloadBody({ data: JSON.stringify(fields) }),
        },
        {
          label: "payload-Data-text",
          path,
          body: payloadBody({ Data: JSON.stringify(fields) }),
        },
        {
          label: "payload-json-text",
          path,
          body: payloadBody({ json: JSON.stringify(fields) }),
        },
        {
          label: "payload-data-array-text",
          path,
          body: payloadBody({ data: JSON.stringify([fields]) }),
        },
        { label: "payload-array", path, body: payloadBody([fields]) },
        { label: "json-params", path, body: fields },
        { label: "json-array", path, body: [fields] },
      ],
      "POST",
      // "Please check data." (HTTP 200, Success:false) = this layout is not what the server wants: try the next one.
      /please\s*check\s*data/i,
    );
    return message || "Record Saved.";
  } catch (e) {
    if (e instanceof ApiError && e.kind !== "auth" && before >= 0) {
      try {
        if ((await count()) > before) return "Saved";
      } catch {
        /* list may be failing too */
      }
    }
    throw e;
  }
}

export async function deleteVoucherById(opts: {
  key: string;
  deletePath: string;
  savePath: string;
  id: string;
  row: Record<string, unknown>;
  stillThere?: () => Promise<boolean>;
}): Promise<string> {
  const { key, deletePath, id, row, stillThere } = opts;
  const num = /^\d+$/.test(id) ? Number(id) : id;
  const url = `${deletePath}?id=${encodeURIComponent(id)}`;

  const send = (method: "DELETE" | "POST", path: string, body?: unknown) =>
    dpuSave(
      path,
      body === undefined ? undefined : JSON.stringify(body),
      method,
      authHeaders(),
    );

  const tries: ListTry[] = preferFirst(`delete.${key}`, [
    {
      name: "post-payload-id",
      run: () => send("POST", url, payloadBody({ id: String(id) })),
    },
    {
      name: "post-payload-id-pascal",
      run: () => send("POST", url, payloadBody({ Id: num })),
    },
    {
      name: "post-payload-row",
      run: () => send("POST", url, payloadBody(row)),
    },
    {
      name: "post-payload-array",
      run: () => send("POST", url, payloadBody([{ id: String(id) }])),
    },
    { name: "post-query-only", run: () => send("POST", url) },
    { name: "delete-query", run: () => send("DELETE", url) },
    {
      name: "delete-payload-id",
      run: () => send("DELETE", url, payloadBody({ id: String(id) })),
    },
  ]);

  const failed: string[] = [];
  for (const t of tries) {
    try {
      const reply = await t.run();
      const message = typeof reply === "string" ? reply : "";
      if (stillThere) {
        let present = false;
        try {
          present = await stillThere();
        } catch {
          present = false; // the list cannot be read: believe the server's answer, the page re-reads the list anyway
        }
        if (present) {
          failed.push(
            `${t.name}: answered OK but the voucher is still in the list`,
          );
          continue;
        }
      }
      remember(`delete.${key}`, t.name);
      return message || "Deleted";
    } catch (e) {
      if (e instanceof ApiError && e.kind === "auth") throw e;
      failed.push(`${t.name}: ${errText(e)}`);
    }
  }
  throw new ApiError(
    `The server did not delete voucher ${id}. ${failed.slice(0, 4).join(" | ")}`,
    "server",
  );
}

export async function sendPath(
  path: string,
  init: () => RequestInit,
): Promise<string> {
  try {
    return await gatewayText(viaGateway(path), init(), 0, true);
  } catch (first) {
    if (!(first instanceof ApiError) || first.kind !== "network") throw first;
    return gatewayText(path, init());
  }
}

export type VoucherFields = Record<string, string | number>;

export function buildForm(fields: VoucherFields): FormData {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields))
    body.append(key, String(value));
  body.append("data", JSON.stringify(fields));
  return body;
}

const buildJson = (fields: VoucherFields): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(fields),
});

const buildUrlEncoded = (fields: VoucherFields): RequestInit => {
  const p = new URLSearchParams();
  for (const [key, value] of Object.entries(fields))
    p.append(key, String(value));
  p.append("data", JSON.stringify(fields));
  return {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: p.toString(),
  };
};

const buildMultipart = (fields: VoucherFields): RequestInit => ({
  method: "POST",
  body: buildForm(fields),
});

const dmy = (iso: unknown): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso);
};

interface Attempt {
  name: string;
  build: (f: VoucherFields) => RequestInit;
  tweak?: (f: VoucherFields) => VoucherFields;
}

/** Receipt vouchers have no deduction type: some servers want 0, not "". */
const zeroDeduction = (f: VoucherFields): VoucherFields => ({
  ...f,
  DeductionType: f.DeductionType === "" ? "0" : f.DeductionType,
});

const ATTEMPTS: Attempt[] = [
  { name: "json", build: buildJson },
  { name: "json+deduction0", build: buildJson, tweak: zeroDeduction },
  { name: "urlencoded", build: buildUrlEncoded, tweak: zeroDeduction },
  { name: "multipart", build: buildMultipart, tweak: zeroDeduction },
  {
    name: "json+dd/MM/yyyy",
    build: buildJson,
    tweak: (f) => ({ ...zeroDeduction(f), EntryDate: dmy(f.EntryDate) }),
  },
  {
    name: "multipart+dd/MM/yyyy",
    build: buildMultipart,
    tweak: (f) => ({ ...zeroDeduction(f), EntryDate: dmy(f.EntryDate) }),
  },
];

let preferred = 0;

const retryable = (e: unknown): boolean =>
  e instanceof ApiError && (e.kind === "server" || e.kind === "network");

/** A 200 reply can still be an error page / {"error": ...} from the gateway. */
function assertNotError(text: string): void {
  const t = text.replace(/[\r\n]+/g, " ").trim();
  if (/^\{\s*"error"\s*:/i.test(t)) {
    throw new ApiError(
      "The server could not save the voucher (internal server error).",
      "server",
    );
  }
}

/**
 * Save a voucher. `count` returns how many vouchers the list shows for the
 * day: if a failed attempt actually stored the row, the count grows and the
 * save is treated as done, so a retry can never create a duplicate.
 */
export async function postVoucher(
  path: string,
  fields: VoucherFields,
  count?: () => Promise<number>,
): Promise<string> {
  let before = -1;
  if (count) {
    try {
      before = await count();
    } catch {
      before = -1;
    }
  }
  const order = [
    preferred,
    ...ATTEMPTS.map((_, i) => i).filter((i) => i !== preferred),
  ];
  const seen = new Set<string>();
  let lastError: unknown = null;
  let tried = 0;

  for (const i of order) {
    const attempt = ATTEMPTS[i]!;
    const sent = attempt.tweak ? attempt.tweak(fields) : fields;
    const key = `${attempt.build === buildJson ? "j" : attempt.build === buildUrlEncoded ? "u" : "m"}${JSON.stringify(sent)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    tried++;
    try {
      const text = await sendPath(path, () => attempt.build(sent));
      assertNotError(text);
      preferred = i;
      return text;
    } catch (e) {
      lastError = e;
      if (!retryable(e)) throw e;
      if (count && before >= 0) {
        try {
          if ((await count()) > before) return "Saved";
        } catch {
          /* ignore: carry on with the next format */
        }
      }
    }
  }

  const detail =
    lastError instanceof ApiError ? lastError.message : "unknown error";
  throw new ApiError(
    `The server rejected the voucher after ${tried} format${tried === 1 ? "" : "s"}. ${detail}`,
    "server",
  );
}

/* ------------------------------------------------------------------ */
/* Live portal save format: POST ?path=/dairy/dairy/paymentvoucher      */
/* body = form field  data=<AES "cipher:iv" of the JSON voucher object> */
/* reply = {"Success":true,"Message":"Record Saved."}                   */
/* ------------------------------------------------------------------ */

const formAsUrlEncoded = (data: string): RequestInit => {
  const p = new URLSearchParams();
  p.append("data", data);
  return {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: p.toString(),
  };
};

const formAsMultipart = (data: string): RequestInit => {
  const f = new FormData();
  f.append("data", data);
  return { method: "POST", body: f };
};

/**
 * Save a voucher exactly the way the live portal does: ONE form post whose
 * only field is `data` = the voucher JSON, AES-encrypted. Only the same
 * payload is ever retried (multipart), never a different shape. If a failed
 * attempt still stored the row, the day's count grows and the save is treated
 * as done - a retry can never create a duplicate.
 */
export async function saveVoucherForm(
  path: string,
  fields: VoucherFields,
  count: () => Promise<number>,
  _label: string,
): Promise<string> {
  const data = encryptPayload(fields);

  let before = -1;
  try {
    before = await count();
  } catch {
    before = -1;
  }

  let lastError: unknown = null;
  for (const build of [formAsUrlEncoded, formAsMultipart]) {
    try {
      const text = await sendPath(path, () => build(data));
      assertNotError(text);
      return text;
    } catch (e) {
      lastError = e;
      if (!retryable(e)) throw e;
      if (before >= 0) {
        try {
          if ((await count()) > before) return "Saved";
        } catch {
          /* list may be failing too: carry on */
        }
      }
    }
  }
  const detail =
    lastError instanceof ApiError ? lastError.message : "unknown error";
  throw new ApiError(`The server rejected the voucher. ${detail}`, "server");
}
