import { useCallback, useMemo, useState } from 'react';
import type { ToastMessage, ToastTone } from '../components/ui/Toast';

/**
 * show('Saved')                    -> green (or red when the text reads like a failure, e.g. "could not be saved")
 * show('Select a VLC', 'warn')     -> orange warning
 * show('Server error', 'error')    -> red
 * show('Please freeze bill', 'info') -> blue
 */
export function useToast() {
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const close = useCallback(() => setMessage(null), []);
  const show = useCallback((text: string, tone?: ToastTone) => setMessage({ id: Date.now() + Math.random(), text, tone }), []);
  return useMemo(() => ({ message, show, close }), [message, show, close]);
}
