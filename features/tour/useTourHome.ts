import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { api, TourHome } from '@/services/api';
import { useLatestRequest } from '@/hooks/useLatestRequest';

// Loads the tour home each time the tab is shown. Returning to the tab or pulling down refreshes
// quietly over what is already there; the error only replaces the screen when there is nothing to show.
export function useTourHome() {
  const [home, setHome] = useState<TourHome | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const request = useLatestRequest();

  const load = useCallback(async (pulled = false) => {
    const isCurrent = request.start();
    if (pulled) setRefreshing(true);
    try {
      const data = await api.getTourHome();
      if (!isCurrent()) return;
      setHome(data);
      setError(false);
    } catch {
      if (isCurrent()) setError(true);
    } finally {
      if (isCurrent()) { setLoading(false); setRefreshing(false); }
    }
  }, [request]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const retry = useCallback(() => { setLoading(true); void load(); }, [load]);
  const refresh = useCallback(() => load(true), [load]);
  return { home, loading, refreshing, error, retry, refresh };
}
