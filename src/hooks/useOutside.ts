import { useEffect, type RefObject } from 'react';

export function useOutside(ref: RefObject<HTMLElement>, fn: () => void, active = true): void {
  useEffect(() => {
    if (!active) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) fn();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fn();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [ref, fn, active]);
}
