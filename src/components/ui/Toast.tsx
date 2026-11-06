import type * as React from 'react';
import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Check, Info, X } from 'lucide-react';

export type ToastTone = 'ok' | 'warn' | 'info' | 'error';
export interface ToastMessage {
  id: number;
  text: string;
  /** leave empty to let the text decide: failure words = error, anything else = ok */
  tone?: ToastTone;
}

interface Props {
  message: ToastMessage | string | null;
  onClose: () => void;
}

/** Server replies can be long: keep the toast to a short, readable line. */
const MAX_LENGTH = 160;
const FAILURE = /\b(could\s*not|couldn'?t|cannot|can'?t|unable|failed|failure|rejected|denied|error|not\s+found|went\s+wrong|timed?\s*out)\b/i;

/** Same look as the toast of the form pages (context/ToastContext.tsx): coloured box + icon, bottom right. */
const BG: Record<ToastTone, string> = { ok: 'bg-ok', error: 'bg-danger', warn: 'bg-warn', info: 'bg-brand' };
const ICON = { ok: Check, warn: AlertTriangle, info: Info, error: X };

export const Toast: React.FC<Props> = ({ message, onClose }) => {
  const item: ToastMessage | null = message === null ? null : typeof message === 'string' ? { id: 0, text: message } : message;
  const text = item ? item.text.replace(/\s+/g, ' ').trim() : '';
  const shown = text.length > MAX_LENGTH ? `${text.slice(0, MAX_LENGTH - 1)}…` : text;
  const tone: ToastTone = item?.tone ?? (FAILURE.test(text) ? 'error' : 'ok');
  const Icon = ICON[tone];

  useEffect(() => {
    if (!item) return undefined;
    const t = setTimeout(onClose, tone === 'error' ? 5200 : 3200);
    return () => clearTimeout(t);
  }, [item, tone, onClose]);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[90] flex flex-col gap-2 max-sm:inset-x-3 max-sm:right-3 safe-bottom" aria-live="polite">
      <AnimatePresence>
        {item && (
          <motion.div
            key={item.id || text}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            role={tone === 'error' || tone === 'warn' ? 'alert' : 'status'}
            onClick={onClose}
            className={`pointer-events-auto flex max-w-sm cursor-pointer items-center gap-3 rounded-md px-5 py-4 text-base font-medium text-white shadow-lg max-sm:max-w-none ${BG[tone]}`}
          >
            {tone === 'error' ? (
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-danger">
                <Icon size={14} strokeWidth={3} aria-hidden />
              </span>
            ) : (
              <Icon size={22} strokeWidth={3} className="shrink-0" aria-hidden />
            )}
            <span className="min-w-0 break-words">{shown}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
