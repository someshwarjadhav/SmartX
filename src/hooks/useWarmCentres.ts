import { useEffect } from 'react';
import { MAX_WARM_CENTRES, WARM_OTHER_CENTRES } from '../services/config';
import { fetchFarmerCollection } from '../services/farmer/farmer.api';
import { fetchVlccCollection } from '../services/vlcc/vlcc.api';
import type { MilkCode, ShiftCode } from '../services/types/raw';

interface Options {
  /** true only when the report on screen has finished loading without problems */
  ready: boolean;
  /** the other centres to load quietly (not the one on screen) */
  ids: string[];
  kind: 'farmer' | 'vlcc';
  from: string;
  to: string;
  shift: ShiftCode;
  milk: MilkCode | 'ALL';
}

/**
 * Loads the same report (same dates, shift and milk) for the other centres of the plant in the background, one centre at a time and
 * at the lowest priority, into the saved day copy. When the person then picks another VLC name and presses Submit, the data is
 * already there. Stops at once when the filters change, a new load starts, or the page is left.
 */
export function useWarmCentres({ ready, ids, kind, from, to, shift, milk }: Options): void {
  const idKey = ids.join(',');
  useEffect(() => {
    if (!WARM_OTHER_CENTRES || !ready || !idKey) return undefined;
    const list = idKey.split(',').filter(Boolean).slice(0, MAX_WARM_CENTRES);
    const ctl = new AbortController();
    // wait a moment so the report that was just shown is not disturbed
    const timer = window.setTimeout(() => {
      void (async () => {
        for (const id of list) {
          if (ctl.signal.aborted) return;
          const params = { from, to, shift, milk, vlccIds: [id], priority: 2 as const };
          try {
            if (kind === 'farmer') await fetchFarmerCollection(params, undefined, ctl.signal);
            else await fetchVlccCollection(params);
          } catch {
            /* background only: a failed centre is simply loaded normally when it is picked */
          }
        }
      })();
    }, 1500);
    return () => {
      window.clearTimeout(timer);
      ctl.abort();
    };
  }, [ready, idKey, kind, from, to, shift, milk]);
}
