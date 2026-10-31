import AES from 'crypto-js/aes';
import Base64 from 'crypto-js/enc-base64';
import Utf8 from 'crypto-js/enc-utf8';
import { lib } from 'crypto-js/core';

const options = (iv: lib.WordArray) => ({ iv });

/** Key from .env.local - trimmed and with accidental surrounding quotes removed. */
function readSecret(): string {
  const raw = String(import.meta.env.VITE_ENCRYPTION_KEY ?? '').trim();
  return raw.replace(/^(['"])(.*)\1$/, '$2').trim();
}

/** True when VITE_ENCRYPTION_KEY is set (login and encrypted replies need it). */
export const hasEncryptionKey = (): boolean => readSecret().length > 0;

function getKey() {
  const secret = readSecret();
  if (!secret) {
    throw new Error('VITE_ENCRYPTION_KEY is missing. Create .env.local (see .env.example) and restart `npm run dev`.');
  }
  return Utf8.parse(secret);
}

export function encryptPayload(data: unknown): string {
  const iv = lib.WordArray.random(16);
  const encrypted = AES.encrypt(JSON.stringify(data), getKey(), options(iv));
  return `${encrypted.ciphertext.toString(Base64)}:${iv.toString(Base64)}`;
}

export function decryptPayload(packed: string): unknown {
  const [cipherB64, ivB64] = packed.split(':');
  if (!cipherB64 || !ivB64) throw new Error('Encrypted value is not in "ciphertext:iv" format.');

  const plain = AES.decrypt(
    { ciphertext: Base64.parse(cipherB64) } as unknown as string,
    getKey(),
    options(Base64.parse(ivB64)),
  ).toString(Utf8); 

  if (!plain) throw new Error('Decryption returned nothing - the key or mode does not match the server.');
  try {
    return JSON.parse(plain);
  } catch {
    return plain;
  }
}
