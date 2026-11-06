import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, DeviceEventEmitter, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/Colors';
import BottomSheet from '@/components/BottomSheet';
import GlassChip from '@/components/GlassChip';
import { CenterMessage } from '@/features/community/ui';
import { useAuth } from '@/contexts/AuthContext';
import { api, type MyTourItem, type MyTourTab } from '@/services/api';
import { TourHeader } from './FormParts';
import { Badge, CardButton, TourEmpty, TourPhotoCard } from './TourCards';
import { type MineAction, type MineGo, mineCard, mineConfirm, mineTabs } from './mine';
import { AFTER_SHEET_MS, GRID_GAP, gridColumns } from './ui';
import { TOURS_CHANGED, useTourRouter } from './nav';

const SIDE = 20;
const INSTRUCTOR_LEVELS = ['5', 'A'];

type Row = { key: string; kind: 'cards'; items: MyTourItem[] } | { key: string; kind: 'ended' };

const merge = (prev: MyTourItem[], next: MyTourItem[]) => [...prev, ...next.filter(item => !prev.some(p => p.id === item.id))];

// 10장 내 투어: 탭 3개 (등록한 · 참여한 · 제안한), 진행 중 위 · 끝난 투어 아래, 큰 사진 카드 한 줄 2개 (펼친 화면 4개)
// 카드를 누르면 투어 상세 · 버튼 하나 · 수정 · 삭제 · 취소는 '⋯'. 최근 순 10개씩 (서버가 최대 100개)
export default function MyToursScreen() {
  const params = useLocalSearchParams<{ tab?: string; focusTourId?: string }>();
  const router = useTourRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const tabs = mineTabs(INSTRUCTOR_LEVELS.includes(String(user?.level ?? '')));
  const pick = (value?: string) => tabs.find(t => t.tab === value)?.tab;
  const [tab, setTab] = useState<MyTourTab>(pick(params.tab) ?? 'REGISTERED');
  const [items, setItems] = useState<MyTourItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [width, setWidth] = useState(0);
  // 시트가 닫히는 동안에도 내용이 남도록 대상과 열림을 따로 둠
  const [menuFor, setMenuFor] = useState<MyTourItem | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const tabRef = useRef(tab); tabRef.current = tab;
  const latest = useRef({ items, hasMore }); latest.current = { items, hasMore };
  const generation = useRef(0); // 탭을 바꾸거나 처음부터 다시 받으면 그 전 응답은 버림
  const offset = useRef(0);
  const moreBusy = useRef(false);
  // 만료 알림으로 열면 (등록자 · 참여자가 받음) 등록한 탭에 그 투어가 없을 때 참여한 탭으로 한 번 넘김
  const focus = useRef(params.focusTourId && !params.tab ? Number(params.focusTourId) : null);
  const loadRef = useRef<(mode?: 'first' | 'refresh' | 'quiet') => Promise<void>>(async () => {});

  // mode: 'first' 로딩 화면 · 'refresh' 당겨서 새로고침 · 'quiet' 보던 만큼 다시 받아서 바꿔 끼움 (목록이 줄지 않게)
  const load = useCallback(async (mode: 'first' | 'refresh' | 'quiet' = 'first') => {
    const gen = ++generation.current;
    const current = tabRef.current;
    moreBusy.current = false; setLoadingMore(false);
    if (mode === 'first') { setState('loading'); setItems([]); setHasMore(false); }
    if (mode === 'refresh') setRefreshing(true);
    const want = mode === 'quiet' ? Math.max(10, latest.current.items.length) : 10;
    try {
      let all: MyTourItem[] = [];
      let at = 0;
      let more = true;
      while (more && all.length < want) {
        const page = await api.getMyTours(current, at);
        if (gen !== generation.current) return;
        at += page.items.length;
        all = merge(all, page.items);
        more = page.hasMore && page.items.length > 0;
      }
      offset.current = at;
      const target = focus.current;
      if (target && current === 'REGISTERED') {
        focus.current = null;
        if (!all.some(item => item.id === target)) { tabRef.current = 'JOINED'; setTab('JOINED'); void loadRef.current('first'); return; }
      }
      setItems(all); setHasMore(more); setState('ready');
    } catch {
      if (gen === generation.current && mode !== 'quiet') setState(prev => (mode === 'refresh' && prev === 'ready' ? prev : 'error'));
    } finally {
      if (gen === generation.current) setRefreshing(false);
    }
  }, []);

  loadRef.current = load;

  const loadMore = useCallback(async () => {
    if (moreBusy.current || !latest.current.hasMore) return;
    moreBusy.current = true; setLoadingMore(true);
    const gen = generation.current;
    try {
      const page = await api.getMyTours(tabRef.current, offset.current);
      if (gen !== generation.current) return;
      offset.current += page.items.length;
      setItems(prev => merge(prev, page.items));
      setHasMore(page.hasMore && page.items.length > 0);
    } catch { /* 다시 내리면 재시도 */ } finally {
      if (gen === generation.current) { moreBusy.current = false; setLoadingMore(false); }
    }
  }, []);

  const switchTab = useCallback((next: MyTourTab) => {
    if (next === tabRef.current) return;
    tabRef.current = next;
    setTab(next);
    void load('first');
  }, [load]);

  // 알림으로 다른 탭을 열면 (예: 제안이 마감됐어요 → 제안한) 그 탭으로
  useEffect(() => {
    const next = pick(params.tab);
    if (next) { switchTab(next); return; }
    if (params.focusTourId && focus.current === null && Number(params.focusTourId) > 0) {
      focus.current = Number(params.focusTourId);
      if (tabRef.current !== 'REGISTERED') switchTab('REGISTERED'); else void load('quiet');
    }
  }, [params.tab, params.focusTourId]); // eslint-disable-line react-hooks/exhaustive-deps

  const first = useRef(true);
  useFocusEffect(useCallback(() => { void load(first.current ? 'first' : 'quiet'); first.current = false; }, [load]));
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(TOURS_CHANGED, () => { void load('quiet'); });
    return () => sub.remove();
  }, [load]);

  const go = (where: MineGo, item: MyTourItem) => {
    const id = String(item.id);
    if (where === 'applications') router.push({ pathname: '/tour-applications', params: { id } });
    else if (where === 'proposals') router.push({ pathname: '/tour-proposals', params: { id } });
    else if (where === 'edit') router.push({ pathname: '/tour-register', params: { id } });
    else if (where === 'proposalEdit' && item.proposal) router.push({ pathname: '/tour-propose', params: { proposalId: String(item.proposal.id) } });
    else router.push({ pathname: '/tour-detail', params: { id } });
  };

  const run = async (action: MineAction, item: MyTourItem) => {
    setBusy(true);
    try {
      if (action === 'delete') await api.deleteTour(item.id);
      if (action === 'cancelEdit') await api.cancelTourEdit(item.id);
      if (action === 'cancelApply') await api.cancelTourApplication(item.id);
      if (action === 'leave') await api.leaveTour(item.id);
      if (action === 'withdraw' && item.proposal) await api.withdrawTourProposal(item.proposal.id);
      DeviceEventEmitter.emit(TOURS_CHANGED);
    } catch (e: any) {
      if (!e?._handled) Alert.alert('알림', e?.message ?? '처리하지 못했어요. 잠시 후 다시 시도해 주세요.');
      void load('quiet');
    } finally {
      setBusy(false);
    }
  };

  const onMenu = (action: MineAction) => {
    const item = menuFor;
    if (!item) return;
    // 메뉴 시트가 다 닫힌 뒤에 다음 화면 · 확인 창을 엶
    setTimeout(() => {
      if (action === 'edit') { go('edit', item); return; }
      const confirm = mineConfirm(action, item);
      if (!confirm) return;
      Alert.alert(confirm.title, confirm.message, [
        { text: '닫기', style: 'cancel' },
        { text: confirm.button, style: confirm.destructive ? 'destructive' : 'default', onPress: () => void run(action, item) },
      ]);
    }, AFTER_SHEET_MS);
  };

  const inner = Math.max(0, width - SIDE * 2);
  const columns = gridColumns(inner);
  const cardWidth = inner ? Math.floor((inner - GRID_GAP * (columns - 1)) / columns) : 0;
  const cards = items.map(item => ({ item, view: mineCard(tab, item) }));
  const rows: Row[] = [];
  const addRows = (list: typeof cards) => {
    for (let i = 0; i < list.length; i += columns) rows.push({ key: `r${list[i].item.id}`, kind: 'cards', items: list.slice(i, i + columns).map(c => c.item) });
  };
  const ongoing = cards.filter(c => !c.view.ended);
  const ended = cards.filter(c => c.view.ended);
  addRows(ongoing);
  if (ended.length) { rows.push({ key: 'ended', kind: 'ended' }); addRows(ended); }
  const viewOf = new Map(cards.map(c => [c.item.id, c.view]));
  const empty = tabs.find(t => t.tab === tab)?.empty ?? '';
  const menuItems = menuFor ? (viewOf.get(menuFor.id)?.menu ?? []).map(m => ({ label: m.label, value: m.action })) : [];

  const renderCard = (item: MyTourItem) => {
    const view = viewOf.get(item.id)!;
    const note = view.noteDetail;
    return (
      <TourPhotoCard tour={item} width={cardWidth} stretch lines={view.lines}
        badge={<Badge {...view.badge} small />}
        onPress={() => go('detail', item)}
        onMenu={view.menu.length ? () => { setMenuFor(item); setMenuOpen(true); } : undefined}
        onNote={note ? () => Alert.alert(note.title, note.body) : undefined}
        footer={<CardButton label={view.button.label} kind={view.button.kind} disabled={busy} onPress={() => go(view.button.go, item)} />} />
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      <TourHeader title="내 투어" onBack={() => router.back()} />
      <View style={styles.tabs} accessibilityRole="tablist">
        {tabs.map(t => (
          <Pressable key={t.tab} accessibilityRole="tab" accessibilityState={{ selected: tab === t.tab }} onPress={() => switchTab(t.tab)}
            style={({ pressed }) => pressed && { opacity: 0.7 }}>
            <GlassChip active={tab === t.tab} fallbackStyle={[styles.tabFallback, tab === t.tab && styles.tabActive]}>
              <Text style={[styles.tabText, tab === t.tab && styles.tabTextActive]}>{t.label}</Text>
            </GlassChip>
          </Pressable>
        ))}
      </View>
      {state !== 'ready' ? <CenterMessage loading={state === 'loading'} message="내 투어를 불러오지 못했어요." onRetry={() => void load()} /> : (
        <FlatList
          // 2개 ↔ 4개가 바뀌면 줄을 다시 나눔 (펼치거나 접을 때)
          key={`mine-${columns}`}
          data={cardWidth ? rows : []}
          keyExtractor={row => row.key}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }, !items.length && { flexGrow: 1 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load('refresh')} tintColor="rgba(255,255,255,0.6)" />}
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.5}
          windowSize={7}
          ListEmptyComponent={<TourEmpty message={empty} />}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.more} color="rgba(255,255,255,0.6)" /> : undefined}
          renderItem={({ item: row }) => row.kind === 'ended' ? (
            <View style={styles.endedHeader}>
              <Text style={styles.endedText}>{tab === 'PROPOSED' ? '끝난 제안' : '끝난 투어'}</Text>
              <View style={styles.endedLine} />
            </View>
          ) : (
            <View style={styles.row}>
              {row.items.map(item => <View key={item.id} style={{ width: cardWidth }}>{renderCard(item)}</View>)}
            </View>
          )}
        />
      )}
      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)} title={menuFor?.name ?? ''} fitContent items={menuItems}
        onSelect={value => onMenu(value as MineAction)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.brand.primary },
  tabs: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: SIDE, paddingTop: 4, paddingBottom: 12 },
  tabFallback: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.08)' },
  tabActive: { backgroundColor: 'rgba(255,255,255,0.22)' },
  tabText: { fontFamily: 'SUIT-SemiBold', fontSize: 14, color: 'rgba(255,255,255,0.6)' },
  tabTextActive: { color: Colors.brand.white },
  list: { paddingHorizontal: SIDE, paddingTop: 4, gap: GRID_GAP },
  row: { flexDirection: 'row', gap: GRID_GAP },
  more: { paddingVertical: 14 },
  endedHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 14, paddingBottom: 2 },
  endedText: { fontFamily: 'SUIT-SemiBold', fontSize: 13, color: 'rgba(255,255,255,0.55)' },
  endedLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.2)' },
});
