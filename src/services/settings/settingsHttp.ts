import { clearRequestMemo } from "../http/client";
import { dpuReadAttempts, dpuWrite, type SaveAttempt } from "../http/dpu";
import { ApiError, EmptyReplyError } from "../http/errors";
import { getSession } from "../session";
import { encryptPayload, encryptXorPayload, hasEncryptionKey } from "../../lib/portal/crypto";
import { isObj } from "../utils/loose";

const cap = (k: string) => k.charAt(0).toUpperCase() + k.slice(1);

/** The server answers 200 + {"Success":false,"Message":"Error occurred.","Details":"..."} for a body it cannot read. */
const WRONG_LAYOUT = /invalid encrypted|not a valid base-?64|padding|index was outside|object reference|unable to cast|^error\.?$|^error occurred\.?$/i;
/** Plain HTTP refusals that only mean "this body shape was not understood". */
const HTTP_LAYOUT_REFUSAL = /error (400|415|422)\b/i;

export function settingsLayouts(path: string, body: unknown): SaveAttempt[] {
  const xor = (v: unknown) => ({ Payload: encryptXorPayload(v) });
  const xorLower = (v: unknown) => ({ payload: encryptXorPayload(v) });
  const attempts: SaveAttempt[] = [
    // Backend team's reference format: { "payload": "<XOR(key) + base64 of the JSON text>" }
    { label: "xor-lower-object", path, body: xorLower(body) },
    { label: "xor-object", path, body: xor(body) },
  ];

  if (hasEncryptionKey()) {
    attempts.push(
      { label: "aes-object", path, body: { payload: encryptPayload(body) } },
      { label: "aes-Object", path, body: { Payload: encryptPayload(body) } },
      { label: "aes-array", path, body: { payload: encryptPayload(isObj(body) ? [body] : body) } },
    );
  }

  attempts.push(
    { label: "xor-data-text", path, body: xor({ data: JSON.stringify(body) }) },
    { label: "xor-Data-text", path, body: xor({ Data: JSON.stringify(body) }) },
  );
  if (isObj(body))
    attempts.push({
      label: "xor-object-pascal",
      path,
      body: xor(Object.fromEntries(Object.entries(body).map(([k, v]) => [cap(k), v]))),
    });
  attempts.push(
    { label: "xor-lower-array", path, body: xorLower(isObj(body) ? [body] : body) },
    { label: "xor-array", path, body: xor(isObj(body) ? [body] : body) },
  );
  return attempts;
}

/** POST an encrypted body and read the (auto-decrypted) reply. */
export const settingsRead = <T>(
  key: string,
  path: string,
  body: unknown,
  parse: (reply: unknown) => T,
): Promise<T> => dpuReadAttempts(key, settingsLayouts(path, body), parse);

/** Layout that worked last time for a path - tried first on the next save (saves one or more wasted requests). */
const lastWinner = new Map<string, string>();

const OK_MESSAGE = /^(done|success|saved|ok|insert|record|data saved|update|updated|data updated)/i;

/** POST an encrypted body to save. Shows the server's real reason (Message + Details) when nothing was accepted. */
export async function settingsSave(_key: string, path: string, body: unknown): Promise<string> {
  const token = getSession()?.token;
  const headers = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  const tried: string[] = [];

  const all = settingsLayouts(path, body);
  const winner = lastWinner.get(path);
  const ordered = winner ? [...all].sort((a, b) => Number(b.label === winner) - Number(a.label === winner)) : all;

  for (const a of ordered) {
    let reply: unknown;
    try {
      reply = await dpuWrite(a.path, { method: "POST", headers, body: JSON.stringify(a.body) }, 1);
    } catch (e) {
      if (e instanceof EmptyReplyError) { lastWinner.set(path, a.label); clearRequestMemo(); return ""; }
      if (e instanceof ApiError && e.kind === "server" && (WRONG_LAYOUT.test(e.message) || HTTP_LAYOUT_REFUSAL.test(e.message))) {
        tried.push(`${a.label}: ${e.message}`);
        continue;
      }
      throw e;
    }

    if (isObj(reply) && (reply.Success ?? reply.success) === false) {
      const message = String(reply.Message ?? reply.message ?? "").trim();
      const details = String(reply.Details ?? reply.details ?? "").trim();
      const text = [message, details].filter(Boolean).join(" - ");
      if (OK_MESSAGE.test(message)) { lastWinner.set(path, a.label); clearRequestMemo(); return message; }
      if (WRONG_LAYOUT.test(text)) { tried.push(`${a.label}: ${text}`); continue; }
      // The server decrypted the body and ran its own code, then failed (e.g. SQL "Invalid object name 'dpusettings'").
      // That is a BACKEND error: the request format was fine, so stop here instead of re-sending the same data in other layouts.
      throw new ApiError(text || "The portal did not save the settings.", "server");
    }
    if (typeof reply === "string" && /^(error|fail|exception)/i.test(reply.trim())) {
      tried.push(`${a.label}: ${reply.trim().slice(0, 120)}`);
      continue;
    }
    lastWinner.set(path, a.label);
    clearRequestMemo();
    return typeof reply === "string" ? reply.trim() : isObj(reply) ? String(reply.Message ?? reply.message ?? "") : "";
  }

  // The FIRST layout is the one the server is meant to read, so its reason is the useful one.
  console.warn("[settings] every layout was refused:", tried);
  const best = tried[0] ?? "no reply";
  throw new ApiError(`Not saved. Server said (${best})`, "server");
}
