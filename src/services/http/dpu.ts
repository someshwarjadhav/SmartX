import { gatewayText, parseGatewayText, type Priority } from './client';
import { getSession } from '../session';
import { ApiError, EmptyReplyError } from './errors';
import { decryptPayload, decryptXorPayload, encryptPayload, hasEncryptionKey } from '../../lib/portal/crypto';

/**
 * DPU API host (https://dpu.shivinfotech.co.in/api). Override with VITE_DPU_BASE_URL if the host changes.
 * Endpoints are written relative to it, e.g. `/Login/getmenu`.
 */
export const DPU_BASE = (import.meta.env.VITE_DPU_BASE_URL || 'https://dpu.shivinfotech.co.in/api').replace(/\/+$/, '');

export const dpuUrl = (path: string): string => `${DPU_BASE}${path.startsWith('/') ? '' : '/'}${path}`;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * The DPU API answers { success: true, data: "<encrypted>" }.
 * Opens `data` (XOR+base64 with VITE_ENCRYPTION_KEY, or AES "cipher:iv") until real JSON is left.
 */
const B64 = /^[A-Za-z0-9+/_-]{16,}={0,2}$/;
const AES_PACKED = /^[A-Za-z0-9+/=]{8,}:[A-Za-z0-9+/=]{16,}$/;

const looksJson = (t: string) => /^[[{]/.test(t.trim());

/**
 * Parses JSON that the server may have cut off in the middle (the menu reply stops inside an entry).
 * Keeps every entry that was written completely and closes the open brackets. Returns undefined if nothing is usable.
 */
function parseCutOffJson(text: string): { value: unknown; complete: boolean } | undefined {
  const t = text.trim();
  try {
    return { value: JSON.parse(t), complete: true };
  } catch {
    /* fall through: try to repair */
  }
  const stack: string[] = [];
  let inStr = false;
  let esc = false;
  let cut: { at: number; open: string[] } | undefined;
  for (let i = 0; i < t.length; i++) {
    const c = t[i]!;
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{' || c === '[') stack.push(c);
    else if (c === '}' || c === ']') {
      stack.pop();
      cut = { at: i + 1, open: [...stack] };
    }
  }
  if (!cut) return undefined;
  const closers = [...cut.open].reverse().map((o) => (o === '{' ? '}' : ']')).join('');
  try {
    return { value: JSON.parse(t.slice(0, cut.at) + closers), complete: false };
  } catch {
    return undefined;
  }
}

export function openDpuReply(v: unknown, depth = 0, salvage = false): unknown {
  if (depth > 6) return v;
  if (typeof v === 'string') {
    // plain JSON text (or JSON inside a string): just parse it
    if (looksJson(v)) {
      const got = salvage ? parseCutOffJson(v) : (() => { try { return { value: JSON.parse(v) as unknown, complete: true }; } catch { return undefined; } })();
      if (!got) return v;
      if (!got.complete) {
        console.warn(
          `[dpu] the server reply was cut off after ${v.length} characters (invalid JSON). Only the complete entries before the cut are used - the API must return the full JSON.`,
        );
      }
      return openDpuReply(got.value, depth + 1, salvage);
    }
    const t = v.replace(/\s+/g, '');
    let opened: unknown = v;
    try {
      if (AES_PACKED.test(t)) opened = decryptPayload(t);
      else if (B64.test(t)) opened = decryptXorPayload(t);
    } catch {
      return v;
    }
    if (typeof opened === 'string') return looksJson(opened) ? openDpuReply(opened, depth + 1, salvage) : v;
    return typeof opened === 'object' && opened !== null ? openDpuReply(opened, depth + 1, salvage) : v;
  }
  if (isObj(v)) {
    for (const k of Object.keys(v)) {
      if (!['data', 'response', 'result', 'payload'].includes(k.toLowerCase())) continue;
      const inner = v[k];
      if (typeof inner !== 'string') continue;
      const opened = openDpuReply(inner, depth + 1, salvage);
      if (opened !== inner) return opened;
    }
  }
  return v;
}

/** True when a reply still carries an unopened (encrypted) string in data/response/result/payload. */
function stillEncrypted(reply: unknown): boolean {
  if (!isObj(reply)) return false;
  return Object.keys(reply).some((k) => {
    if (!['data', 'response', 'result', 'payload'].includes(k.toLowerCase())) return false;
    const inner = reply[k];
    if (typeof inner !== 'string') return false;
    const t = inner.replace(/\s+/g, '');
    return AES_PACKED.test(t) || B64.test(t);
  });
}

async function dpuSend(path: string, init: RequestInit, priority: Priority): Promise<unknown> {
  const label = `[dpu] ${init.method ?? 'GET'} ${path}`;
  const text = await gatewayText(dpuUrl(path), init, priority, true);
  const reply = openDpuReply(parseGatewayText(text), 0, true);
  if (stillEncrypted(reply)) {
    console.error(`${label} - reply could not be decrypted (check VITE_ENCRYPTION_KEY). Raw reply:`, text.slice(0, 500));
    throw new ApiError(
      'The DPU reply is encrypted and could not be decrypted. Check VITE_ENCRYPTION_KEY in .env.local.',
      'parse',
    );
  }
  // decrypted JSON, printed as plain text so it can be copied straight from the console (F12 > Console)
  try {
    console.log(`${label} - decrypted JSON:\n${JSON.stringify(reply, null, 2)}`);
  } catch {
    console.log(`${label} - decrypted reply:`, reply);
  }
  return reply;
}

/** GET on the DPU API (path relative to DPU_BASE, query string included). Returns the decrypted JSON. */
export const dpuGet = (path: string, priority: Priority = 1): Promise<unknown> =>
  dpuSend(path, { method: 'GET' }, priority);

/** POST (JSON body) on the DPU API. Returns the decrypted JSON. */
export const dpuPostJson = (path: string, body: Record<string, unknown>, priority: Priority = 1): Promise<unknown> =>
  dpuSend(
    path,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    priority,
  );


/**
 * Write calls (POST / PUT). Same as dpuSend, but a reply that is plain text (not JSON) is returned as that text
 * instead of failing - save endpoints often answer with just a message.
 */
async function dpuWrite(path: string, init: RequestInit, priority: Priority): Promise<unknown> {
  const label = `[dpu] ${init.method ?? 'POST'} ${path}`;
  const text = await gatewayText(dpuUrl(path), init, priority, true);
  let reply: unknown;
  try {
    reply = openDpuReply(parseGatewayText(text), 0, true);
  } catch (e) {
    if (e instanceof EmptyReplyError) throw e;
    if (e instanceof ApiError && e.kind === 'parse' && text.trim() && !text.trim().startsWith('<')) {
      console.log(`${label} - text reply:`, text.slice(0, 500));
      return text.trim();
    }
    throw e;
  }
  if (stillEncrypted(reply)) {
    console.error(`${label} - reply could not be decrypted (check VITE_ENCRYPTION_KEY). Raw reply:`, text.slice(0, 500));
    throw new ApiError('The DPU reply is encrypted and could not be decrypted. Check VITE_ENCRYPTION_KEY in .env.local.', 'parse');
  }
  try {
    console.log(`${label} - decrypted JSON:\n${JSON.stringify(reply, null, 2)}`);
  } catch {
    console.log(`${label} - decrypted reply:`, reply);
  }
  return reply;
}

/** POST with any body (FormData, query-string only, ...) on the DPU API. Returns the decrypted reply. */
export const dpuPost = (path: string, body?: BodyInit, priority: Priority = 1): Promise<unknown> =>
  dpuWrite(path, body === undefined ? { method: 'POST' } : { method: 'POST', body }, priority);

/** PUT on the DPU API (parameters in the query string unless a body is given). */
export const dpuPut = (path: string, body?: BodyInit, priority: Priority = 1): Promise<unknown> =>
  dpuWrite(path, body === undefined ? { method: 'PUT' } : { method: 'PUT', body }, priority);

/**
 * Save calls (MilkCollection / RateExcel / updateCollectionRate ...): runs the POST (or PUT) and returns the
 * server message. An empty reply counts as saved; { success:false } (or status:false) is raised as an ApiError.
 */
export async function dpuSave(
  path: string,
  body?: BodyInit,
  method: 'POST' | 'PUT' | 'DELETE' = 'POST',
  headers?: Record<string, string>,
): Promise<string> {
  let reply: unknown;
  try {
    const init: RequestInit = { method };
    if (body !== undefined) init.body = body;
    if (headers) init.headers = headers;
    reply = await dpuWrite(path, init, 1);
  } catch (e) {
    if (e instanceof EmptyReplyError) return '';
    throw e;
  }
  if (typeof reply === 'string') {
    if (/^(error|fail|exception)/i.test(reply.trim())) throw new ApiError(reply.trim(), 'server');
    return reply.trim();
  }
  if (!isObj(reply)) return '';
  const inner = reply.data ?? reply.Data;
  const message = String(reply.Message ?? reply.message ?? (typeof inner === 'string' ? inner : '') ?? '').trim();
  const flag = reply.Success ?? reply.success ?? reply.status ?? reply.Status;
  if (flag === false && !/^(done|success|saved|ok|insert|record)/i.test(message)) {
    throw new ApiError(message || 'The portal did not save this entry.', 'server');
  }
  return message;
}

/**
 * Save with a JSON body. The DPU save endpoints refuse form-data / query-only requests (415 Unsupported Media Type)
 * and want application/json, but the exact shape of the JSON is only visible in Swagger. So the given body shapes
 * are tried in order; the next one is tried only when the server REFUSED the previous one (400 / 415 / 422, i.e.
 * the request was rejected before anything was saved). Any other error, or success, ends the loop.
 * Every refusal is printed in the console (F12) with the server's reason.
 */
export async function dpuSaveJson(path: string, variants: unknown[], method: 'POST' | 'PUT' = 'POST'): Promise<string> {
  let last: unknown;
  for (let i = 0; i < variants.length; i++) {
    try {
      return await dpuSave(path, JSON.stringify(variants[i]), method, { 'Content-Type': 'application/json' });
    } catch (e) {
      last = e;
      const refused = e instanceof ApiError && /error (400|415|422)\b|^no\s*data\b/i.test(e.message.trim());
      console.warn(`[dpu] ${method} ${path} - body shape ${i + 1}/${variants.length} refused:`, e instanceof Error ? e.message : e);
      if (!refused) throw e;
    }
  }
  throw last;
}

/** Turns the named fields of every row into numbers (for APIs whose model uses number types). */
export const withNumbers = (rows: Array<Record<string, unknown>>, names: string[]): Array<Record<string, unknown>> =>
  rows.map((r) => {
    const o: Record<string, unknown> = { ...r };
    for (const n of names) {
      const v = o[n];
      if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) o[n] = Number(v);
    }
    return o;
  });

/**
 * DPU save endpoints work like login: the body is { "Payload": "<AES text>" } where the text is the data object
 * encrypted with encryptPayload ("cipher:iv", key VITE_ENCRYPTION_KEY). One body per value is returned,
 * to be tried in order by dpuSaveJson (the server answers "No Data" when the inside has not the shape it reads).
 */
export function encryptedShapes(...values: unknown[]): unknown[] {
  if (!hasEncryptionKey())
    throw new ApiError('VITE_ENCRYPTION_KEY is missing in .env.local. Add it and restart `npm run dev`.', 'config');
  return values.map((v) => ({ Payload: encryptPayload(v) }));
}

/** One way of sending a save request: its own URL (query string may differ) and its own JSON body. */
export interface SaveAttempt {
  label: string;
  path: string;
  body: unknown;
}

const winningLabel = new Map<string, string>();
const REFUSED = /error (400|415|422)\b|^no\s*data\b/i;
const LAYOUT_REFUSAL =
  /error (400|415|422)\b|^no\s*data\b|^error\.?$|could not be converted|json value|json request|base-?64|payload|is required|unsupported media|not a valid|unexpected character|deserializ/i;

/**
 * Like dpuSaveJson, but every attempt has its own URL + body and is labelled.
 * - The attempt that worked last time (per `key`) is tried first, so later saves need only one request.
 * - Only a refusal (400 / 415 / 422 / "No Data") moves on to the next attempt; any other error stops at once.
 * - When every attempt is refused, ONE clear error is raised and a table of what the server said to each attempt is
 *   printed in the console (F12). "No Data" with HTTP 200 means the server read the request but did not find the
 *   fields it expects - the table shows which layouts were tried.
 */
export async function dpuSaveAttempts(
  key: string,
  attempts: SaveAttempt[],
  method: 'POST' | 'PUT' | 'DELETE' = 'POST',
): Promise<string> {
  const first = winningLabel.get(key);
  const ordered = first ? [...attempts].sort((a, b) => Number(b.label === first) - Number(a.label === first)) : attempts;
  const log: Array<{ attempt: string; server: string }> = [];
  for (const a of ordered) {
    try {
      // the DPU settings save sends the login token as a Bearer header; without it the server may not know who is saving
      const token = getSession()?.token;
      const message = await dpuSave(a.path, JSON.stringify(a.body), method, {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      });
      winningLabel.set(key, a.label);
      console.info(`[dpu] ${key}: saved with layout "${a.label}"`);
      return message;
    } catch (e) {
      const text = e instanceof Error ? e.message : String(e);
      log.push({ attempt: a.label, server: text });
      // a refusal = the server read the request but did not accept it ("No Data", "Error.", "Payload is required", base64 text,
      // 400 / 415 / 422). A 5xx, an auth error or a network error stops at once.
      // Only a refusal of the REQUEST SHAPE moves on to the next layout (400 / 415 / 422, "No Data", a JSON type / binding
      // message, a missing or bad Payload). Any other server message (e.g. an SQL error raised while the server was already
      // processing the record) stops here, so a record that may already be stored is never sent a second time.
      const refused = e instanceof ApiError && e.kind === 'server' && LAYOUT_REFUSAL.test(text.trim());
      if (!refused && !(e instanceof ApiError && REFUSED.test(text.trim()))) throw e;
    }
  }
  console.warn(`[dpu] ${key}: the server refused every layout`);
  console.table(log);
  // show what the server said to each layout (distinct messages), not only the last one
  const distinct = [...new Set(log.map((l) => l.server))];
  throw new ApiError(
    distinct.length === 1
      ? `The server answered "${distinct[0]}" to all ${log.length} request layouts, so nothing was saved.`
      : `The server refused all ${log.length} request layouts, so nothing was saved. Server said: ` +
        distinct.map((m, i) => `(${i + 1}) ${m}`).join(' '),
    'server',
  );
}

/**
 * Read calls that are POST with an encrypted body (e.g. FarmerMaster): every attempt has its own body layout and
 * `parse` turns the decrypted reply into the result (it throws an ApiError when the reply is not what it wants).
 * Same rules as dpuSaveAttempts: the layout that worked last time is tried first; a refusal moves on to the next
 * layout; a 5xx / auth / network error stops at once; when all are refused ONE error lists what the server said.
 */
export async function dpuReadAttempts<T>(
  key: string,
  attempts: SaveAttempt[],
  parse: (reply: unknown) => T,
  method: 'POST' | 'PUT' = 'POST',
): Promise<T> {
  const memoKey = `read:${key}`;
  const first = winningLabel.get(memoKey);
  const ordered = first ? [...attempts].sort((a, b) => Number(b.label === first) - Number(a.label === first)) : attempts;
  const log: Array<{ attempt: string; server: string }> = [];
  for (const a of ordered) {
    try {
      const token = getSession()?.token;
      const reply = await dpuWrite(
        a.path,
        {
          method,
          body: JSON.stringify(a.body),
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        },
        1,
      );
      const out = parse(reply);
      winningLabel.set(memoKey, a.label);
      return out;
    } catch (e) {
      const text = e instanceof Error ? e.message : String(e);
      log.push({ attempt: a.label, server: text });
      const refused = e instanceof ApiError && (e.kind === 'server' || e.kind === 'parse') && !/error 5\d\d\b/.test(text);
      if (!refused) throw e;
    }
  }
  console.warn(`[dpu] ${key}: the server refused every layout`);
  console.table(log);
  const distinct = [...new Set(log.map((l) => l.server))];
  throw new ApiError(
    distinct.length === 1
      ? distinct[0]!
      : `The server refused all ${log.length} request layouts. Server said: ` + distinct.map((m, i) => `(${i + 1}) ${m}`).join(' '),
    'server',
  );
}
