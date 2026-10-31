import type * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, Search } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavGroups } from '../../config/nav';
import { cn } from '../../lib/cn';

interface Props {
  open: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<Props> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const groups = useNavGroups();
  const ENTRIES = useMemo(() => groups.flatMap((g) => g.items.map((item) => ({ item, group: g.title }))), [groups]);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ENTRIES;
    return ENTRIES.filter(({ item, group }) => `${item.label} ${group} ${item.hint}`.toLowerCase().includes(q));
  }, [query, ENTRIES]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setIndex(0);
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open]);

  useEffect(() => setIndex(0), [query]);

  const go = (to: string) => {
    navigate(to);
    onClose();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndex((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      const hit = results[index];
      if (hit) go(hit.item.to);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-start justify-center bg-deep/60 p-3 pt-[12dvh] backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Search pages"
        >
          <motion.div
            initial={{ y: -12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -12, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-panel shadow-pop"
            onKeyDown={onKey}
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search size={18} className="text-mute" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search pages…"
                aria-label="Search pages"
                className="h-14 w-full bg-transparent text-base outline-none placeholder:text-mute/70"
              />
            </div>
            <ul className="max-h-[50dvh] overflow-y-auto p-2">
              {results.map(({ item, group }, i) => {
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    <button
                      onMouseEnter={() => setIndex(i)}
                      onClick={() => go(item.to)}
                      className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left', i === index ? 'bg-brand/10' : 'hover:bg-soft')}
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-soft text-brand">
                        <Icon size={17} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{item.label}</span>
                        <span className="block truncate text-xs text-mute">{group} · {item.hint}</span>
                      </span>
                      {i === index && <CornerDownLeft size={14} className="shrink-0 text-mute" />}
                    </button>
                  </li>
                );
              })}
              {results.length === 0 && <li className="px-3 py-8 text-center text-sm text-mute">No page matches “{query}”.</li>}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
