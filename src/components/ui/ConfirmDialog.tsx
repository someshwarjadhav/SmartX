import type * as React from 'react';
import { useEffect, useId } from 'react';
import { Button } from './Button';

interface Props {
  open: boolean;
  title: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children: React.ReactNode;
}

export const ConfirmDialog: React.FC<Props> = ({
  open,
  title,
  busy = false,
  onConfirm,
  onCancel,
  children,
}) => {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-deep/55 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-2xl border border-line bg-panel p-5 shadow-pop"
      >
        <h2 id={titleId} className="font-display text-lg font-bold">{title}</h2>
        <div className="mt-4 text-sm">{children}</div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" loading={busy} onClick={onConfirm}>
            Delete
          </Button>
        </div>
      </section>
    </div>
  );
};
