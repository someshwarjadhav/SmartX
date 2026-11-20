import { BASE_URL, REQUEST_TIMEOUT_MS } from "../config";
import { encryptPayload, hasEncryptionKey } from "../../lib/portal/crypto";
import { ApiError } from "../http/errors";

const HOST = BASE_URL || "https://smartx.shivinfotech.co.in";
export const REGISTER_URL = `${HOST}/home/register`;

const ENCRYPT_BODY = false;

export interface RegisterForm {
  username: string;
  email: string;
  password: string;
  mobile: string;
}

function buildBody(f: RegisterForm): Record<string, unknown> {
  const data = {
    username: f.username.trim(),
    email: f.email.trim(),
    password: f.password,
    mobile: f.mobile.trim(),
  };
  if (!ENCRYPT_BODY) return data;
  if (!hasEncryptionKey()) {
    throw new ApiError(
      "VITE_ENCRYPTION_KEY is missing in .env.local.",
      "config",
    );
  }
  return { payload: encryptPayload(data) };
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const FAILED = /^(false|fail|failed|error|invalid)$/i;

export async function registerApi(form: RegisterForm): Promise<string> {
  const body = buildBody(form);

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(REGISTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = (await res.text()).trim();
    if (text.startsWith("<")) {
      throw new ApiError(
        "The registration service is not reachable right now. Please try again later.",
        "server",
      );
    }

    let json: unknown = text;
    try {
      json = text ? JSON.parse(text) : null;
      if (typeof json === "string") {
        try {
          json = JSON.parse(json);
        } catch {}
      }
    } catch {
      json = text;
    }

    const message = isObj(json)
      ? String(
          json.Message ?? json.message ?? json.msg ?? json.error ?? "",
        ).trim()
      : typeof json === "string"
        ? json.trim()
        : "";

    if (!res.ok) {
      throw new ApiError(
        message ||
          `Registration failed (error ${res.status}). Please try again.`,
        "server",
      );
    }

    if (isObj(json)) {
      const flag = json.Success ?? json.success ?? json.status ?? json.Status;
      if (flag === false || FAILED.test(String(flag ?? ""))) {
        throw new ApiError(
          message || "Registration failed. Please check your details.",
          "server",
        );
      }
    } else if (
      typeof json === "string" &&
      FAILED.test(json.split(/[\s:.-]/)[0] ?? "")
    ) {
      throw new ApiError(json, "server");
    }

    return message && message.length < 160
      ? message
      : "Account created successfully. Please sign in.";
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (controller.signal.aborted) {
      throw new ApiError(
        "The server took too long to respond. Please try again.",
        "timeout",
      );
    }
    throw new ApiError(
      "Cannot reach the server. Check your internet connection and try again.",
      "network",
    );
  } finally {
    window.clearTimeout(timer);
  }
}
