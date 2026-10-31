import { useCallback, useState } from 'react';

export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const close = useCallback(() => setMessage(null), []);
  return { message, show: setMessage, close };
}
