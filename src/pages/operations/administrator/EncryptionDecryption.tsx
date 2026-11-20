import type * as React from 'react';
import { useState } from 'react';
import AES from 'crypto-js/aes';
import Base64 from 'crypto-js/enc-base64';
import Utf8 from 'crypto-js/enc-utf8';
import { lib } from 'crypto-js/core';
import { Check, Copy, KeyRound, Lock, Trash2, Unlock } from 'lucide-react';
import { Card, CardHeader } from '../../../components/operations/ui/Card';
import { Button } from '../../../components/operations/ui/Button';
import { Field, Input } from '../../../components/operations/ui/Fields';
import { Textarea } from '../../../components/ui/Fields';
import { CardTitle, ReportPage, Reveal } from '../../../components/operations/ReportKit';


const xorEncrypt = (text: string, key: string): string => {
  const k = new TextEncoder().encode(key);
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]! ^ k[i % k.length]!);
  return btoa(bin);
};


const READABLE = /^[\t\n\r\x20-\x7E\u00A0-\u024F\u0900-\u097F]*$/;

const xorDecrypt = (text: string, key: string): string | null => {
  try {
    const k = new TextEncoder().encode(key);
   
    let clean = text.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
    while (clean.length % 4) clean += '=';
    const bin = atob(clean);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i) ^ k[i % k.length]!;
    const plain = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return plain !== '' && READABLE.test(plain) ? plain : null;
  } catch {
    return null;
  }
};


const AES_KEY_LENGTHS = [16, 24, 32];

const aesKeyError = (key: string): string | null =>
  AES_KEY_LENGTHS.includes(new TextEncoder().encode(key).length)
    ? null
    : 'AES key must be exactly 16, 24 or 32 characters long.';

const aesEncrypt = (text: string, key: string): string => {
  const iv = lib.WordArray.random(16);
  const encrypted = AES.encrypt(text, Utf8.parse(key), { iv });
  return `${encrypted.ciphertext.toString(Base64)}:${iv.toString(Base64)}`;
};

const aesDecrypt = (packed: string, key: string): string | null => {
  try {
    const [cipherB64, ivB64] = packed.replace(/\s+/g, '').replace(/^"|"$/g, '').split(':');
    if (!cipherB64 || !ivB64) return null;
    const plain = AES.decrypt(
      { ciphertext: Base64.parse(cipherB64) } as unknown as string,
      Utf8.parse(key),
      { iv: Base64.parse(ivB64) },
    ).toString(Utf8);
    return plain !== '' ? plain : null;
  } catch {
    return null;
  }
};


const EncryptionDecryption: React.FC = () => {
  const [secretKey, setSecretKey] = useState('');
  const [text, setText] = useState('');
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const show = (value: string, err = '') => {
    setResult(value);
    setError(err);
    setCopied(false);
  };

  const xorEnc = () => show(xorEncrypt(text, secretKey));

  const xorDec = () => {
    const plain = xorDecrypt(text, secretKey);
    if (plain === null) show('', 'XOR decrypt failed. Check that the key is correct and the text is XOR + base64.');
    else show(plain);
  };

  const aesEnc = () => {
    const bad = aesKeyError(secretKey);
    if (bad) return show('', bad);
    show(aesEncrypt(text, secretKey));
  };

  const aesDec = () => {
    const bad = aesKeyError(secretKey);
    if (bad) return show('', bad);
    const plain = aesDecrypt(text, secretKey);
    if (plain === null) show('', 'AES decrypt failed. Check that the key is correct and the text looks like "cipher:iv".');
    else show(plain);
  };

  const copyResult = async () => {
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
    }
  };

  const clearAll = () => {
    setText('');
    show('');
  };

  const disabled = text.trim() === '' || secretKey.trim() === '';

  return (
    <ReportPage title="Encryption/Decryption">
      <Reveal delay={0.05}>
        <Card>
          <CardHeader title={<CardTitle icon={KeyRound}>Encrypt / Decrypt a string</CardTitle>} />
          <div className="space-y-5 p-4 sm:p-6">
            <Field label="Key" className="max-w-md">
              <Input
                type="text"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder="Enter your key"
                autoComplete="off"
                aria-label="Key"
              />
            </Field>

            <div className="grid gap-5 lg:grid-cols-2">
              <Field label="Your string" className="min-w-0">
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Enter your string or JSON"
                  rows={12}
                  className="min-h-[18rem] resize-y"
                  aria-label="Your string"
                />
              </Field>

              <Field label="Result" className="min-w-0">
                <Textarea
                  value={result}
                  readOnly
                  rows={12}
                  placeholder="Result will appear here"
                  className="min-h-[18rem] resize-y bg-soft/40"
                  aria-label="Result"
                />
              </Field>
            </div>

            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-line p-4">
                <p className="mb-3 text-sm font-semibold text-ink">XOR (base64)</p>
                <div className="flex flex-wrap items-center gap-3">
                  <Button icon={<Lock size={16} />} disabled={disabled} onClick={xorEnc}>
                    DPU Encrypt
                  </Button>
                  <Button variant="outline" icon={<Unlock size={16} />} disabled={disabled} onClick={xorDec}>
                    DPU Decrypt
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-line p-4">
                <p className="mb-3 text-sm font-semibold text-ink">AES-CBC (cipher:iv)</p>
                <div className="flex flex-wrap items-center gap-3">
                  <Button icon={<Lock size={16} />} disabled={disabled} onClick={aesEnc}>
                    Application Encrypt
                  </Button>
                  <Button variant="outline" icon={<Unlock size={16} />} disabled={disabled} onClick={aesDec}>
                    Application Decrypt
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="soft"
                size="sm"
                icon={copied ? <Check size={15} /> : <Copy size={15} />}
                disabled={result === ''}
                onClick={copyResult}
              >
                {copied ? 'Copied' : 'Copy result'}
              </Button>
              <Button variant="ghost" size="sm" icon={<Trash2 size={15} />} onClick={clearAll}>
                Clear
              </Button>
            </div>
          </div>
        </Card>
      </Reveal>
    </ReportPage>
  );
};

export default EncryptionDecryption;