import { useCallback, useRef, useState } from 'react';

// 목록 공통 패턴: 최근 순 10개씩, 아래로 내리면 10개씩 더. 화면에는 최대 100개만 들고,
// 넘으면 반대쪽 10개를 덜어냈다가 그쪽으로 다시 스크롤하면 다시 받아 옴 (너무 많이 그리지 않게).
// FlatList에 onEndReached = loadOlder, onStartReached = loadNewer, maintainVisibleContentPosition을 함께 씀.
// base = 지금 첫 글이 목록 전체에서 몇 번째인지 (처음 받으면 0, 위를 덜어내면 늘고 위에 붙이면 줆).
// 한 줄에 여러 개(카드 2 · 4개)일 때 이 자리로 줄을 나누면 10개씩 붙이거나 덜어도 남은 줄이 그대로라 보던 자리가 안 튐 (listRows.ts).
// epoch = 처음부터 다시 받은 횟수 (줄 나누기 기준을 새로 잡을 때)
export const LIST_KEEP_MAX = 100;
const TRIM = 10;

export type Page<T> = { items: T[]; hasMore: boolean };
export type Cursor = { before?: number; after?: number };
export type ListWindow<T> = { items: T[]; base: number; epoch: number };

// 아래에 더 예전 글을 붙이고, 100개가 넘으면 위에서 덜어냄 (덜어낸 만큼 base가 늘어남)
export function withOlder<T extends { id: number }>(prev: ListWindow<T>, page: T[]): { win: ListWindow<T>; trimmed: boolean } {
  const next = [...prev.items, ...page.filter(i => !prev.items.some(p => p.id === i.id))];
  if (next.length <= LIST_KEEP_MAX) return { win: { ...prev, items: next }, trimmed: false };
  const cut = Math.max(TRIM, next.length - LIST_KEEP_MAX);
  return { win: { ...prev, items: next.slice(cut), base: prev.base + cut }, trimmed: true };
}

// 위에 더 최근 글을 붙이고 (붙인 만큼 base가 줆), 100개가 넘으면 아래에서 덜어냄
export function withNewer<T extends { id: number }>(prev: ListWindow<T>, page: T[]): { win: ListWindow<T>; trimmed: boolean } {
  const added = page.filter(i => !prev.items.some(p => p.id === i.id));
  const next = [...added, ...prev.items];
  const base = prev.base - added.length;
  if (next.length <= LIST_KEEP_MAX) return { win: { ...prev, items: next, base }, trimmed: false };
  return { win: { ...prev, items: next.slice(0, Math.min(LIST_KEEP_MAX, next.length - TRIM)), base }, trimmed: true };
}

export function useWindowedList<T extends { id: number }>(fetchPage: (cursor: Cursor) => Promise<Page<T>>) {
  // items · base는 한 번에 바뀌어야 줄 나누기가 어긋나지 않아서 같이 둠
  const [win, setWin] = useState<ListWindow<T>>({ items: [], base: 0, epoch: 0 });
  const items = win.items;
  const [hasOlder, setHasOlder] = useState(false); // 아래쪽(더 예전)에 더 있음
  const [hasNewer, setHasNewer] = useState(false); // 위쪽을 덜어냈음
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [more, setMore] = useState<'older' | 'newer' | null>(null);
  const busy = useRef(false);
  const generation = useRef(0); // 처음부터 다시 받으면 그 전에 보낸 더 받기 결과는 버림
  const fetchRef = useRef(fetchPage); fetchRef.current = fetchPage;
  const latest = useRef({ items, hasOlder, hasNewer }); latest.current = { items, hasOlder, hasNewer };

  const setItems = useCallback((update: T[] | ((prev: T[]) => T[])) => {
    setWin(prev => ({ ...prev, items: typeof update === 'function' ? update(prev.items) : update }));
  }, []);

  // mode: 'first'는 로딩 화면, 'refresh'는 당겨서 새로고침, 'quiet'는 지금 목록을 둔 채로
  const reload = useCallback(async (mode: 'first' | 'refresh' | 'quiet' = 'first') => {
    const gen = ++generation.current;
    busy.current = false; setMore(null);
    if (mode === 'first') setState('loading');
    if (mode === 'refresh') setRefreshing(true);
    try {
      const page = await fetchRef.current({});
      if (gen !== generation.current) return;
      setWin(prev => ({ items: page.items, base: 0, epoch: prev.epoch + 1 }));
      setHasOlder(page.hasMore); setHasNewer(false); setState('ready');
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
      // 덜어냈는지는 setWin 계산 안에서만 알 수 있어서 그 자리에서 표시
      setWin(prev => {
        const { win: next, trimmed } = withOlder(prev, page.items);
        if (trimmed) setHasNewer(true);
        return next;
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
      setWin(prev => {
        const { win: next, trimmed } = withNewer(prev, page.items);
        if (trimmed) setHasOlder(true);
        return next;
      });
      setHasNewer(page.hasMore);
    } catch { /* 다시 올리면 재시도 */ } finally {
      if (gen === generation.current) { busy.current = false; setMore(null); }
    }
  }, []);

  return { items, base: win.base, epoch: win.epoch, setItems, state, refreshing, more, hasNewer, reload, loadOlder, loadNewer };
}

// 줄 나누기 기준(무리마다 처음 본 맨 앞 자리)을 처음부터 다시 받을 때까지 기억 (listRows.ts의 gridRows · essayRows에 넘김)
export function useRowAnchors(epoch: number) {
  const ref = useRef({ epoch: -1, anchors: new Map<string, number>() });
  if (ref.current.epoch !== epoch) ref.current = { epoch, anchors: new Map() };
  return ref.current.anchors;
}
