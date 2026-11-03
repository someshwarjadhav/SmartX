import { gatewayText } from "../http/client";
import { ApiError } from "../http/errors";
import { decryptPayload } from "../../lib/portal/crypto";
import { isObj } from "../utils/loose";

export interface VlcMilkBillQuery {
  fromdate: string;
  todate: string;
  /** Every VLC / centre id the signed-in user can see. The portal wants them comma separated. */
  stationIds: string[];
}

const ENCRYPTED = /^[A-Za-z0-9+/=]{8,}:[A-Za-z0-9+/=]{16,}$/;

/** Finds the bill markup inside whatever the portal sent (plain HTML, a JSON string, or an object). */
function markupFrom(reply: unknown, depth = 0): string {
  if (depth > 4 || reply === null || reply === undefined) return "";
  if (typeof reply === "string") {
    const t = reply.trim();
    if (!t || t === "null" || t === "[]" || t === "{}") return "";
    if (ENCRYPTED.test(t.replace(/[\r\n]+/g, ""))) {
      try {
        return markupFrom(decryptPayload(t.replace(/[\r\n]+/g, "")), depth + 1);
      } catch {
        throw new ApiError(
          "The server reply is encrypted and could not be decrypted. Check VITE_ENCRYPTION_KEY in .env.local.",
          "parse",
        );
      }
    }
    if (t.startsWith("<")) return t;
    if (t.startsWith('"') || t.startsWith("{") || t.startsWith("[")) {
      try {
        return markupFrom(JSON.parse(t), depth + 1);
      } catch {
        /* not JSON, fall through */
      }
    }
    if (/no\s*record/i.test(t)) return "";
    return `<p>${t.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!)}</p>`;
  }
  if (Array.isArray(reply)) {
    return reply.map((x) => markupFrom(x, depth + 1)).join("");
  }
  if (isObj(reply)) {
    const ok = reply.Success ?? reply.success;
    const msg = String(reply.Message ?? reply.message ?? "").trim();
    if (ok === false) {
      if (!msg || /no\s*record/i.test(msg)) return "";
      throw new ApiError(msg, "server");
    }
    return Object.values(reply)
      .map((v) =>
        typeof v === "string" && !v.includes("<")
          ? ""
          : markupFrom(v, depth + 1),
      )
      .join("");
  }
  return "";
}

/**
 * VLC milk bill for a date range, for all of the user's centres in one call:
 * GET /home/VlccBillProcess?id=0&fromdate=…&todate=…&bmcid=7010101,7010102,…
 * The portal answers with the bill as HTML text, so it is read as text (not JSON).
 */
export async function getVlcMilkBill(q: VlcMilkBillQuery): Promise<string> {
  const qs =
    `id=0&fromdate=${encodeURIComponent(q.fromdate)}` +
    `&todate=${encodeURIComponent(q.todate)}` +
    // commas are the separator the portal expects, so they are sent as they are
    `&bmcid=${q.stationIds.map((id) => encodeURIComponent(id)).join(",")}`;
  const text = await gatewayText(`/home/VlccBillProcess?${qs}`, {}, 1);
  return markupFrom(text);
}
