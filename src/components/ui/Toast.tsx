import type * as React from 'react';
import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';

interface Props {
  message: string | null;
  onClose: () => void;
}

export const Toast: React.FC<Props> = ({ message, onClose }) => {
  useEffect(() => {
    if (!message) return undefined;
    const t = setTimeout(onClose, 3600);
    return () => clearTimeout(t);
  }, [message, onClose]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex justify-center px-4 pb-5 safe-bottom" role="status" aria-live="polite">
      <AnimatePresence>
        {message && (
          <motion.div
            key={message}
            initial={{ y: 30, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 340 }}
            className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl bg-deep px-4 py-3 text-sm font-semibold text-white shadow-pop"
          >
            <CheckCircle2 size={18} className="shrink-0 text-ok" aria-hidden />
            <span>{message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
