import { readFileSync } from "node:fs";
import { createDecipheriv } from "node:crypto";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const raw = /^VITE_ENCRYPTION_KEY=(.*)$/m
  .exec(env)?.[1]
  ?.trim()
  .replace(/^(['"])(.*)\1$/, "$2")
  .trim();
if (!raw) throw new Error("VITE_ENCRYPTION_KEY not found in .env.local");
const key = Buffer.from(raw, "utf8");

let input = process.argv.slice(2).join(" ").trim();
if (!input)
  throw new Error(
    'Pass the Payload text:  node scripts/decrypt-payload.mjs "<text>"',
  );
try {
  const j = JSON.parse(input);
  input = String(j.Payload ?? j.payload ?? j.data ?? j.Data ?? input);
} catch {
  input = input.replace(/^"|"$/g, "");
}

const aes = (packed) => {
  const [c, iv] = packed.split(":");
  const algo =
    key.length === 32
      ? "aes-256-cbc"
      : key.length === 24
        ? "aes-192-cbc"
        : "aes-128-cbc";
  const d = createDecipheriv(algo, key, Buffer.from(iv, "base64"));
  return Buffer.concat([
    d.update(Buffer.from(c, "base64")),
    d.final(),
  ]).toString("utf8");
};
const xor = (b64) => {
  const b = Buffer.from(b64.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  return Buffer.from(b.map((x, i) => x ^ key[i % key.length])).toString("utf8");
};

const text = input.includes(":") ? aes(input) : xor(input);
try {
  console.log(JSON.stringify(JSON.parse(text), null, 2));
} catch {
  console.log(text);
}
