// Usage:  node scripts/fetch-menu.mjs [userid]        (default userid = 218)
//         npm run menu:json -- 218
// Fetches https://dpu.shivinfotech.co.in/api/Login/menu?userid=<id>, decrypts the reply with
// VITE_ENCRYPTION_KEY (read from .env.local) and saves the decrypted JSON to menu.decrypted.json
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import CryptoJS from 'crypto-js';

const userid = process.argv[2] || '218';
const base = (process.env.DPU_BASE_URL || 'https://dpu.shivinfotech.co.in/api').replace(/\/+$/, '');
const url = process.env.DPU_MENU_URL || `${base}/Login/menu?userid=${encodeURIComponent(userid)}`;

function readKey() {
  for (const f of ['.env.local', '.env.development.local', '.env.development', '.env']) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = /^\s*VITE_ENCRYPTION_KEY\s*=\s*(.*)\s*$/.exec(line);
      if (m) return m[1].trim().replace(/^(['"])(.*)\1$/, '$2').trim();
    }
  }
  return process.env.VITE_ENCRYPTION_KEY || '';
}
const key = readKey();
if (!key) {
  console.error('VITE_ENCRYPTION_KEY not found in .env.local - add it first.');
  process.exit(1);
}

const B64 = /^[A-Za-z0-9+/_-]{16,}={0,2}$/;
const AES_PACKED = /^[A-Za-z0-9+/=]{8,}:[A-Za-z0-9+/=]{16,}$/;
const looksJson = (t) => /^[[{]/.test(t.trim());
const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

function xor(b64) {
  let clean = b64.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  while (clean.length % 4) clean += '=';
  const bytes = Buffer.from(clean, 'base64');
  const k = Buffer.from(key, 'utf8');
  for (let i = 0; i < bytes.length; i++) bytes[i] ^= k[i % k.length];
  return bytes.toString('utf8').replace(/^\uFEFF/, '').trim();
}
function aes(packed) {
  const [c, iv] = packed.split(':');
  const plain = CryptoJS.AES.decrypt(
    { ciphertext: CryptoJS.enc.Base64.parse(c) },
    CryptoJS.enc.Utf8.parse(key),
    { iv: CryptoJS.enc.Base64.parse(iv) },
  ).toString(CryptoJS.enc.Utf8);
  return plain;
}

function open(v, depth = 0) {
  if (depth > 6) return v;
  if (typeof v === 'string') {
    if (looksJson(v)) {
      try { return open(JSON.parse(v), depth + 1); } catch { return v; }
    }
    const t = v.replace(/\s+/g, '');
    let text;
    try { text = AES_PACKED.test(t) ? aes(t) : B64.test(t) ? xor(t) : null; } catch { return v; }
    if (text === null || text === '') return v;
    try { return open(JSON.parse(text), depth + 1); } catch { return looksJson(text) ? v : text; }
  }
  if (isObj(v)) {
    for (const k of Object.keys(v)) {
      if (!['data', 'response', 'result', 'payload'].includes(k.toLowerCase())) continue;
      if (typeof v[k] !== 'string') continue;
      const o = open(v[k], depth + 1);
      if (o !== v[k]) return o;
    }
  }
  return v;
}

console.log('GET', url);
const res = await fetch(url, { headers: { Accept: 'application/json, text/plain, */*' } });
const text = await res.text();
console.log('status', res.status, '| reply length', text.length);
if (!res.ok) {
  console.error(text.slice(0, 500));
  process.exit(1);
}
let json;
try { json = JSON.parse(text.replace(/[\r\n]+/g, '')); } catch { json = text.trim(); }
const out = open(json);
writeFileSync('menu.decrypted.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2).slice(0, 4000));
const rows = Array.isArray(out) ? out : (isObj(out) ? Object.values(out).find(Array.isArray) : null);
if (rows?.[0]) console.log('\nrows:', rows.length, '| keys of first row:', Object.keys(rows[0]).join(', '));
console.log('\nSaved full decrypted JSON -> menu.decrypted.json');
