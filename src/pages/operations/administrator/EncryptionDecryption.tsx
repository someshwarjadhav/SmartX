import type * as React from 'react';
import { useState } from 'react';
import { KeyRound, Lock, Unlock } from 'lucide-react';
import { Card, CardHeader } from '../../../components/operations/ui/Card';
import { Button } from '../../../components/operations/ui/Button';
import { Field, Input } from '../../../components/operations/ui/Fields';
import { Textarea } from '../../../components/ui/Fields';
import { CardTitle, ReportPage, Reveal } from '../../../components/operations/ReportKit';

const encryptText = (text: string, key: string): string => {
  const k = new TextEncoder().encode(key);
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]! ^ k[i % k.length]!);
  return btoa(bin);
};


const READABLE = /^[\t\n\r\x20-\x7E\u00A0-\u024F\u0900-\u097F]*$/;


const decryptText = (text: string, key: string): string | null => {
  try {
    const k = new TextEncoder().encode(key);
    const bin = atob(text.trim());
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i) ^ k[i % k.length]!;
    const plain = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return plain !== '' && READABLE.test(plain) ? plain : null; 
  } catch {
    return null;
  }
};

const EncryptionDecryption: React.FC = () => {
  const [secretKey, setSecretKey] = useState('');
  const [text, setText] = useState('');
  const [result, setResult] = useState('');


  const encrypt = () => setResult(decryptText(text, secretKey) !== null ? '' : encryptText(text, secretKey));

  
  const decrypt = () => setResult(decryptText(text, secretKey) ?? '');

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

            <div className="flex flex-wrap items-center gap-3">
              <Button icon={<Lock size={16} />} disabled={disabled} onClick={encrypt}>
                Encrypt
              </Button>
              <Button variant="outline" icon={<Unlock size={16} />} disabled={disabled} onClick={decrypt}>
                Decrypt
              </Button>
            </div>
          </div>
        </Card>
      </Reveal>
    </ReportPage>
  );
};

export default EncryptionDecryption;