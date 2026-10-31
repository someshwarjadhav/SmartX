import type * as React from 'react';
import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Button } from './Button';

export interface ExportAction {
  id: string;
  label: string;
  icon: LucideIcon;
  variant: 'primary' | 'danger' | 'success' | 'outline';
  run: () => void | Promise<void>;
}

interface Props {
  actions: ExportAction[];
  disabled?: boolean;
}

export const ExportBar: React.FC<Props> = ({ actions, disabled }) => {
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (action: ExportAction) => {
    setBusy(action.id);
    try {
      await action.run();
    } finally {
      setBusy(null);
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
            loading={busy === a.id}
            disabled={disabled || (busy !== null && busy !== a.id)}
            onClick={() => run(a)}
          >
            {a.label}
          </Button>
        );
      })}
    </>
  );
};
