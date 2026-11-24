import type * as React from 'react';
import { useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Button } from './Button';

export interface ExportAction {
  id: string;
  label: string;
  icon: LucideIcon;
  variant: 'primary' | 'danger' | 'success' | 'outline' | 'print';
  run: () => void | Promise<void>;
}

interface Props {
  actions: ExportAction[];
  disabled?: boolean;
}

export const ExportBar: React.FC<Props> = ({ actions, disabled }) => {
  // only ONE export runs at a time: while one is being made the other buttons wait, so no second file opens
  const [running, setRunning] = useState<ReadonlySet<string>>(() => new Set());
  const lock = useRef<Set<string>>(new Set());

  const run = async (action: ExportAction) => {
    if (lock.current.size > 0) return; // any export already running (same or another button)
    lock.current.add(action.id);
    setRunning(new Set(lock.current));
    try {
      await action.run();
    } finally {
      // keep the spinner visible for a moment so a very fast export still gives feedback
      window.setTimeout(() => {
        lock.current.delete(action.id);
        setRunning(new Set(lock.current));
      }, 450);
    }
  };

  return (
    <>
      {actions.map((a) => {
        const Icon = a.icon;
        return (
          <Button
            key={a.id}
            size="sm"
            variant={a.variant}
            icon={<Icon size={15} aria-hidden />}
            loading={running.has(a.id)}
            disabled={disabled || (running.size > 0 && !running.has(a.id))}
            onClick={() => void run(a)}
          >
            {a.label}
          </Button>
        );
      })}
    </>
  );
};
