import { useCallback, useEffect, useState } from 'react';

export const useAsyncData = (loader, deps = []) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const next = await loader();
      setData(next);
    } catch (err) {
      setError(err?.message || 'Unable to load data.');
    } finally {
      setLoading(false);
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
};
