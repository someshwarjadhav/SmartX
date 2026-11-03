import { gatewayText, parseGatewayText, type Priority } from './client';
import { ApiError } from './errors';
import { decryptPayload, decryptXorPayload } from '../../lib/portal/crypto';

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
