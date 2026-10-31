import { useEffect, useState } from 'react';

export function useBusyDelay(trigger: unknown, ms = 450): boolean {
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    setBusy(true);
    const t = setTimeout(() => setBusy(false), ms);
    return () => clearTimeout(t);
  }, [trigger, ms]);

  return busy;
}
