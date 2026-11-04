import { useCallback, useRef, useState } from 'react';

// 목록 공통 패턴: 최근 순 10개씩, 아래로 내리면 10개씩 더. 화면에는 최대 100개만 들고,
// 넘으면 반대쪽 10개를 덜어냈다가 그쪽으로 다시 스크롤하면 다시 받아 옴 (너무 많이 그리지 않게).
// FlatList에 onEndReached = loadOlder, onStartReached = loadNewer, maintainVisibleContentPosition을 함께 씀.
export const LIST_KEEP_MAX = 100;
const TRIM = 10;

export type Page<T> = { items: T[]; hasMore: boolean };
export type Cursor = { before?: number; after?: number };

export function useWindowedList<T extends { id: number }>(fetchPage: (cursor: Cursor) => Promise<Page<T>>) {
  const [items, setItems] = useState<T[]>([]);
  const [hasOlder, setHasOlder] = useState(false); // 아래쪽(더 예전)에 더 있음
  const [hasNewer, setHasNewer] = useState(false); // 위쪽을 덜어냈음
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [more, setMore] = useState<'older' | 'newer' | null>(null);
  const busy = useRef(false);
  const generation = useRef(0); // 처음부터 다시 받으면 그 전에 보낸 더 받기 결과는 버림
  const fetchRef = useRef(fetchPage); fetchRef.current = fetchPage;
  const latest = useRef({ items, hasOlder, hasNewer }); latest.current = { items, hasOlder, hasNewer };

  // mode: 'first'는 로딩 화면, 'refresh'는 당겨서 새로고침, 'quiet'는 지금 목록을 둔 채로
  const reload = useCallback(async (mode: 'first' | 'refresh' | 'quiet' = 'first') => {
    const gen = ++generation.current;
    busy.current = false; setMore(null);
    if (mode === 'first') setState('loading');
    if (mode === 'refresh') setRefreshing(true);
    try {
      const page = await fetchRef.current({});
      if (gen !== generation.current) return;
      setItems(page.items); setHasOlder(page.hasMore); setHasNewer(false); setState('ready');
    } catch {
      if (gen === generation.current && mode !== 'quiet') setState(prev => (mode === 'refresh' && prev === 'ready' ? prev : 'error'));
    } finally {
      if (gen === generation.current) setRefreshing(false);
    }
  }, []);

  const loadOlder = useCallback(async () => {
    const { items: list, hasOlder: more } = latest.current;
    if (busy.current || !more || !list.length) return;
    busy.current = true; setMore('older');
    const gen = generation.current;
    try {
      const page = await fetchRef.current({ before: list[list.length - 1].id });
      if (gen !== generation.current) return;
      // 덜어냈는지는 setItems 계산 안에서만 알 수 있어서 그 자리에서 표시
      setItems(prev => {
        const next = [...prev, ...page.items.filter(i => !prev.some(p => p.id === i.id))];
        if (next.length <= LIST_KEEP_MAX) return next;
        setHasNewer(true);
        return next.slice(Math.max(TRIM, next.length - LIST_KEEP_MAX));
      });
      setHasOlder(page.hasMore);
    } catch { /* 다시 내리면 재시도 */ } finally {
      if (gen === generation.current) { busy.current = false; setMore(null); }
    }
  }, []);

  const loadNewer = useCallback(async () => {
    const { items: list, hasNewer: more } = latest.current;
    if (busy.current || !more || !list.length) return;
    busy.current = true; setMore('newer');
    const gen = generation.current;
    try {
      const page = await fetchRef.current({ after: list[0].id });
      if (gen !== generation.current) return;
      setItems(prev => {
        const next = [...page.items.filter(i => !prev.some(p => p.id === i.id)), ...prev];
        if (next.length <= LIST_KEEP_MAX) return next;
        setHasOlder(true);
        return next.slice(0, Math.min(LIST_KEEP_MAX, next.length - TRIM));
      });
      setHasNewer(page.hasMore);
    } catch { /* 다시 올리면 재시도 */ } finally {
      if (gen === generation.current) { busy.current = false; setMore(null); }
    }
  }, []);

  return { items, setItems, state, refreshing, more, hasNewer, reload, loadOlder, loadNewer };
}
