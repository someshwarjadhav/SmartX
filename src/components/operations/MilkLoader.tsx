import type * as React from 'react';
import { TableLoader } from '../ui/TableLoader';

export type LoaderVariant = 'image' | 'glass' | 'drops' | 'ring' | 'bars';

/**
 * Loader used by the operations tables. It now renders the shared TableLoader so every
 * table in the app loads the same way. The props are unchanged, so no page needs editing.
 */
export const MilkLoader: React.FC<{
  label?: string;
  variant?: LoaderVariant;
  className?: string;
  done?: number;
  total?: number;
}> = ({ label = 'Loading data from the SmartX portal…', className, done, total }) => <TableLoader label={label} className={className} done={done} total={total} />;
