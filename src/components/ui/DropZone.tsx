import type * as React from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { FileSpreadsheet, UploadCloud, X } from 'lucide-react';
import { cn } from '../../lib/cn';

interface Props {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
  accept?: string;
  error?: string;
}

const size = (bytes: number): string => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export const DropZone: React.FC<Props> = ({ label, file, onChange, accept, error }) => {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  useEffect(() => {
    if (!file && ref.current) ref.current.value = '';
  }, [file]);

  const drop = (e: React.DragEvent) => {
    e.preventDefault();
    setOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) onChange(dropped);
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={drop}
        className={cn(
          'relative rounded-2xl border-2 border-dashed px-4 py-5 text-center transition',
          over ? 'scale-[1.01] border-brand bg-brand/10' : 'border-line bg-soft/40 hover:border-brand/60',
          error && 'border-danger/70',
        )}
      >
        <input ref={ref} id={id} type="file" aria-label={label} accept={accept} onChange={(e) => onChange(e.target.files?.[0] ?? null)} className="sr-only" />
        {file ? (
          <div className="flex items-center gap-3 text-left">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ok/12 text-ok">
              <FileSpreadsheet size={20} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{file.name}</p>
              <p className="text-xs text-mute">{size(file.size)}</p>
            </div>
            <button type="button" onClick={() => onChange(null)} aria-label="Remove file" className="grid h-8 w-8 place-items-center rounded-lg text-mute transition hover:bg-danger/10 hover:text-danger">
              <X size={16} />
            </button>
          </div>
        ) : (
          <label htmlFor={id} className="block cursor-pointer">
            <UploadCloud size={30} className={cn('mx-auto text-brand transition-transform', over && '-translate-y-1')} aria-hidden />
            <span className="mt-2 inline-flex h-9 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-brand-ink shadow-card transition hover:brightness-110">Choose File</span>
            <span className="mt-2 block text-xs text-mute">No file chosen · or drag and drop it here</span>
          </label>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-xs font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
};
