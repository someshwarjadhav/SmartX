
import { readFileSync } from "node:fs";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const raw = /^VITE_ENCRYPTION_KEY=(.*)$/m
  .exec(env)?.[1]
  ?.trim()
  .replace(/^(['"])(.*)\1$/, "$2")
  .trim();
if (!raw) throw new Error("VITE_ENCRYPTION_KEY not found in .env.local");
const key = Buffer.from(raw, "utf8");
const xor = (buf) => Buffer.from(buf.map((b, i) => b ^ key[i % key.length]));

const algo =
  key.length === 32
    ? "aes-256-cbc"
    : key.length === 24
      ? "aes-192-cbc"
      : "aes-128-cbc";
const aesEncrypt = (text) => {
  const iv = randomBytes(16);
  const c = createCipheriv(algo, key, iv);
  return `${Buffer.concat([c.update(Buffer.from(text, "utf8")), c.final()]).toString("base64")}:${iv.toString("base64")}`;
};
const aesDecrypt = (packed) => {
  const [c, iv] = packed.split(":");
  const d = createDecipheriv(algo, key, Buffer.from(iv, "base64"));
  return Buffer.concat([
    d.update(Buffer.from(c, "base64")),
    d.final(),
  ]).toString("utf8");
};

const args = process.argv.slice(2);
if (args[0] === "--aes") {
  const json = args.slice(1).join(" ").trim();
  JSON.parse(json);
  console.log(JSON.stringify({ payload: aesEncrypt(json) }));
} else if (args[0] === "--decode-aes") {
  let t = args.slice(1).join(" ").trim();
  try {
    const j = JSON.parse(t);
    t = String(j.payload ?? j.Payload ?? t);
  } catch {
    t = t.replace(/^"|"$/g, "");
  }
  console.log(aesDecrypt(t));
} else if (args[0] === "--decode") {
  let t = args.slice(1).join(" ").trim();
  try {
    const j = JSON.parse(t);
    t = String(j.payload ?? j.Payload ?? t);
  } catch {
    t = t.replace(/^"|"$/g, "");
  }
  const b = Buffer.from(t.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  console.log(xor(b).toString("utf8"));
} else {
  const json = args.join(" ").trim();
  JSON.parse(json); // fail early on bad JSON
  console.log(
    JSON.stringify({
      payload: xor(Buffer.from(json, "utf8")).toString("base64"),
    }),
  );
}
