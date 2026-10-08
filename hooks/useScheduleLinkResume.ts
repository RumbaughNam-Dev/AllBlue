import { useEffect, useRef } from 'react';

// Keep a schedule destination while onboarding/login temporarily replaces its route.
export function useScheduleLinkResume({ route, id, filter, isLoading, isLoggedIn, replace }: {
  route: string | undefined;
  id: string | string[] | undefined;
  filter: string | string[] | undefined;
  isLoading: boolean;
  isLoggedIn: boolean;
  replace: (destination: { pathname: '/schedule-detail'; params: { id: string; filter: string } }) => void;
}) {
  const pending = useRef<{ id: string; filter: string } | null>(null);

  useEffect(() => {
    if (route === 'schedule-detail' && !isLoggedIn && typeof id === 'string'
      && /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id))) {
      pending.current = { id, filter: typeof filter === 'string' ? filter : 'notification' };
    }
    if (!isLoading && isLoggedIn && route === 'schedule-detail') {
      pending.current = null;
    }
    // Login handlers first navigate to the tabs. Resume afterwards so their
    // replace('/(tabs)') cannot overwrite the requested schedule.
    if (!isLoading && isLoggedIn && route === '(tabs)' && pending.current) {
      const params = pending.current;
      pending.current = null;
      replace({ pathname: '/schedule-detail', params });
    }
  }, [route, id, filter, isLoading, isLoggedIn, replace]);
}
