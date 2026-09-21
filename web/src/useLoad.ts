import { useCallback, useEffect, useRef, useState } from 'react';
import { describeError } from './api';

export interface Loaded<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  /** When `data` last arrived (ms). */
  updatedAt: number | null;
  refresh: () => void;
}

/**
 * Loads once, then again every `everyMs` while the page is visible, and whenever the phone comes back to the app. A failed
 * refresh keeps the last good data on screen and says so, rather than blanking it.
 */
export function useLoad<T>(load: () => Promise<T>, everyMs: number): Loaded<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const busy = useRef(false);
  const loader = useRef(load);
  loader.current = load;

  const refresh = useCallback(() => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    loader
      .current()
      .then((result) => {
        setData(result);
        setError(null);
        setUpdatedAt(Date.now());
      })
      .catch((err) => setError(describeError(err)))
      .finally(() => {
        busy.current = false;
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, everyMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh, everyMs]);

  return { data, error, loading, updatedAt, refresh };
}
