import { useEffect, useRef, useState } from 'react';

/**
 * Smooth "is loading" flag for the table / page loaders.
 *
 * - `delay`   : a very fast request (cache hit, small reply) never flashes the loader.
 * - `minShow` : once the loader is visible it stays at least this long, so it does not blink.
 *
 * Unlike the old fixed 450 ms timer (useBusyDelay), the loader now follows the REAL request:
 * it appears only while a request is running and disappears as soon as the data (or the error) arrives.
 */
export function useSmoothLoading(loading: boolean, delay = 150, minShow = 400): boolean {
  const [show, setShow] = useState(false);
  const shownAt = useRef(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (loading) {
      timer = setTimeout(() => {
        shownAt.current = Date.now();
        setShow(true);
      }, delay);
    } else if (shownAt.current) {
      const left = Math.max(0, minShow - (Date.now() - shownAt.current));
      timer = setTimeout(() => {
        shownAt.current = 0;
        setShow(false);
      }, left);
    } else {
      setShow(false);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [loading, delay, minShow]);

  return show;
}
