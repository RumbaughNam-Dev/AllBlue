import { useEffect, useRef } from 'react';

type Destination =
  | { pathname: '/schedule-detail'; params: { id: string; filter: string } }
  | { pathname: '/tour-detail'; params: { id: string } };

// Routes a link can open while signed out (일정 링크, 21장 투어 공유 링크)
const LINK_ROUTES = ['schedule-detail', 'tour-detail'];

// Keep a schedule or tour destination while onboarding/login temporarily replaces its route.
export function useScheduleLinkResume({ route, id, filter, isLoading, isLoggedIn, replace }: {
  route: string | undefined;
  id: string | string[] | undefined;
  filter: string | string[] | undefined;
  isLoading: boolean;
  isLoggedIn: boolean;
  replace: (destination: Destination) => void;
}) {
  const pending = useRef<Destination | null>(null);

  useEffect(() => {
    if (route && LINK_ROUTES.includes(route) && !isLoggedIn && typeof id === 'string'
      && /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id))) {
      pending.current = route === 'tour-detail'
        ? { pathname: '/tour-detail', params: { id } }
        : { pathname: '/schedule-detail', params: { id, filter: typeof filter === 'string' ? filter : 'notification' } };
    }
    if (!isLoading && isLoggedIn && route && LINK_ROUTES.includes(route)) {
      pending.current = null;
    }
    // Login handlers first navigate to the tabs. Resume afterwards so their
    // replace('/(tabs)') cannot overwrite the requested destination.
    if (!isLoading && isLoggedIn && route === '(tabs)' && pending.current) {
      const destination = pending.current;
      pending.current = null;
      replace(destination);
    }
  }, [route, id, filter, isLoading, isLoggedIn, replace]);
}
