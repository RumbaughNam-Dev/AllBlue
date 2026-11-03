import { useCallback, useEffect, useState } from 'react';
import { api, CommonCode } from '@/services/api';

type Regions = { continents: CommonCode[]; countries: CommonCode[] };
// The lists rarely change; load them once per app run and share them between screens.
let cached: Regions | null = null;

export const regionName = (codes: CommonCode[], code: string) => {
  const item = codes.find(c => c.code === code);
  return item ? item.nameKo ?? item.name : '';
};

// 대륙 → 나라 목록 (common_code TOUR_CONTINENT · TOUR_COUNTRY, 나라의 extraValue = 대륙)
export function useTourRegions() {
  const [regions, setRegions] = useState<Regions>(cached ?? { continents: [], countries: [] });
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (cached) { setRegions(cached); return; }
    try {
      const [c, n] = await Promise.all([api.getCodes('TOUR_CONTINENT'), api.getCodes('TOUR_COUNTRY')]);
      if (!c.data?.length || !n.data?.length) throw new Error('empty');
      cached = { continents: c.data, countries: n.data };
      setRegions(cached);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const countriesOf = useCallback((continent: string) => regions.countries.filter(c => c.extraValue === continent), [regions]);
  return { ...regions, failed, reload: load, countriesOf };
}
