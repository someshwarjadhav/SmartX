import type * as React from 'react';
import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface Props {
  message: string | null;
  onClose: () => void;
}

/** Server replies can be long: keep the toast to a short, readable line. */
const MAX_LENGTH = 160;
const FAILURE = /\b(could\s*not|couldn'?t|cannot|can'?t|unable|failed|failure|rejected|denied|error|not\s+found|went\s+wrong|timed?\s*out)\b/i;

export const Toast: React.FC<Props> = ({ message, onClose }) => {
  const text = message ? message.replace(/\s+/g, ' ').trim() : '';
  const shown = text.length > MAX_LENGTH ? `${text.slice(0, MAX_LENGTH - 1)}…` : text;
  const failed = FAILURE.test(text);

  useEffect(() => {
    if (!message) return undefined;
    const t = setTimeout(onClose, failed ? 5200 : 3600);
    return () => clearTimeout(t);
  }, [message, failed, onClose]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex justify-center px-3 pb-5 sm:px-4 safe-bottom" role={failed ? 'alert' : 'status'} aria-live="polite">
      <AnimatePresence>
        {message && (
          <motion.div
            key={message}
            initial={{ y: 30, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 340 }}
            onClick={onClose}
            className="pointer-events-auto flex w-full max-w-md cursor-pointer items-center gap-3 rounded-2xl bg-deep px-4 py-3 text-sm font-semibold text-white shadow-pop sm:w-auto sm:min-w-[260px]"
          >
            {failed ? <AlertCircle size={18} className="shrink-0 text-danger" aria-hidden /> : <CheckCircle2 size={18} className="shrink-0 text-ok" aria-hidden />}
            <span className="min-w-0 break-words">{shown}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
