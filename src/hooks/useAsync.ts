import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { errorMessage } from '@/lib/errors';
import { onDataChanged } from '@/lib/dataEvents';

/**
 * Loads data whenever the screen gains focus (so lists refresh after editing
 * on another screen). Keeps the previous data while reloading.
 */
export function useFocusData<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loaderRef = useRef(loader);
  // Declared before useFocusEffect so the latest loader is in place when it runs.
  useEffect(() => {
    loaderRef.current = loader;
  });

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loaderRef.current());
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );
  // Data changed somewhere else (an undo, say): refresh even if this screen didn't lose focus.
  useEffect(() => onDataChanged(reload), [reload]);

  return { data, setData, error, loading, reload };
}
