import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator, RefreshControl, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { api, TourCard, TourSearchConditions, TourSort } from '@/services/api';
import BottomSheet from '@/components/BottomSheet';
import GlassCircle from '@/components/GlassCircle';
import GlassChip from '@/components/GlassChip';
import StripBackSlot from '@/components/StripBackSlot';
import { useAppRouter, useIsPaneRoot, useScreenParams } from '@/features/split/SplitPane';
import { useLatestRequest } from '@/hooks/useLatestRequest';
import TourSearchPopup, { EMPTY_SEARCH } from './TourSearchPopup';
import { TourCardItem, TourEmpty, TourRow } from './TourCards';
import { showTourComingSoon } from './ui';
import { regionName, useTourRegions } from './useTourRegions';

const SIDE = 20;
const GAP = 10;
const VIEW_KEY = 'tourSearchView';

// 6장 정렬. RECENT · POPULAR는 홈 '전체보기'로 열었을 때만 목록에 들어감.
export const SORT_LABELS: Record<TourSort, string> = {
  DEADLINE: '마감 임박순', START_ASC: '출발일 빠른 순', START_DESC: '출발일 늦은 순',
  CAPACITY_ASC: '모집 인원 적은 순', CAPACITY_DESC: '모집 인원 많은 순', RECENT: '최근 등록순', POPULAR: '관심 많은 순',
};
const SEARCH_SORTS: TourSort[] = ['DEADLINE', 'START_ASC', 'START_DESC', 'CAPACITY_ASC', 'CAPACITY_DESC'];
const isSort = (value?: string): value is TourSort => !!value && value in SORT_LABELS;

const short = (day: string) => `${day.slice(5, 7)}.${day.slice(8, 10)}`;

// 6장 검색 결과 (홈 '전체보기'도 조건 없이 이 화면). 결과가 없으면 7장.
export default function TourSearchScreen() {
  const params = useScreenParams<Partial<Record<keyof TourSearchConditions | 'sort', string>>>();
  const router = useAppRouter();
  const isPaneRoot = useIsPaneRoot();
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(useWindowDimensions().width);
  const [conditions, setConditions] = useState<TourSearchConditions>({
    ...EMPTY_SEARCH,
    ...Object.fromEntries(Object.keys(EMPTY_SEARCH).map(key => [key, params[key as keyof TourSearchConditions] ?? ''])),
  });
  const openedSort = isSort(params.sort) ? params.sort : 'DEADLINE';
  const sorts = SEARCH_SORTS.includes(openedSort) ? SEARCH_SORTS : [openedSort, ...SEARCH_SORTS];
  const [sort, setSort] = useState<TourSort>(openedSort);
  const [view, setView] = useState<'card' | 'list'>('card');
  const [tours, setTours] = useState<TourCard[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [popup, setPopup] = useState(false);
  const [sortSheet, setSortSheet] = useState(false);
  const request = useLatestRequest();
  const loadingMoreRef = useRef(false);
  const { continents, countries } = useTourRegions();

  // 마지막에 고른 보기를 기억
  useEffect(() => {
    AsyncStorage.getItem(VIEW_KEY).then(saved => { if (saved === 'card' || saved === 'list') setView(saved); }).catch(() => {});
  }, []);
  const changeView = (next: 'card' | 'list') => {
    setView(next);
    AsyncStorage.setItem(VIEW_KEY, next).catch(() => {});
  };

  const load = useCallback(async (mode: 'first' | 'refresh') => {
    const isCurrent = request.start();
    if (mode === 'first') setLoading(true); else setRefreshing(true);
    try {
      const result = await api.searchTours(conditions, sort);
      if (!isCurrent()) return;
      setTours(result.tours); setTotal(result.total); setHasMore(result.hasMore); setError(false);
    } catch {
      if (isCurrent()) setError(true);
    } finally {
      if (isCurrent()) { setLoading(false); setRefreshing(false); }
    }
  }, [conditions, sort, request]);
  useEffect(() => { void load('first'); }, [load]);

  const loadMore = async () => {
    if (!hasMore || loadingMoreRef.current || loading) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const isCurrent = request.start();
    try {
      const result = await api.searchTours(conditions, sort, tours.length);
      if (!isCurrent()) return;
      setTours(prev => [...prev, ...result.tours.filter(t => !prev.some(p => p.id === t.id))]);
      setTotal(result.total); setHasMore(result.hasMore);
    } catch {
      // Keep what is shown; scrolling to the end again retries.
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  };

  // 조건 요약: "'세부' · 아시아 › 필리핀" / "11.01 ~ 11.30 · 인솔 강사 전체"
  const region = conditions.continent
    ? `${regionName(continents, conditions.continent)}${conditions.country ? ` › ${regionName(countries, conditions.country)}` : ''}`
    : '';
  const firstLine = [conditions.title && `'${conditions.title}'`, region].filter(Boolean).join(' · ') || '모든 지역의 투어';
  const period = conditions.from || conditions.to
    ? `${conditions.from ? short(conditions.from) : ''} ~ ${conditions.to ? short(conditions.to) : ''}`
    : '기간 전체';
  const secondLine = `${period} · ${conditions.instructor ? `인솔 강사 '${conditions.instructor}'` : '인솔 강사 전체'}`;

  const cardWidth = Math.floor((width - SIDE * 2 - GAP) / 2);
  const openTour = () => showTourComingSoon();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      <View style={styles.header}>
        {isPaneRoot ? <View style={styles.backButton} /> : (
          <StripBackSlot size={36}>
            <Pressable accessibilityRole="button" accessibilityLabel="뒤로" onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}>
              <GlassCircle fallbackStyle={styles.backCircle}>
                <Text style={styles.backArrow}>{'<'}</Text>
              </GlassCircle>
            </Pressable>
          </StripBackSlot>
        )}
        <Text style={styles.headerTitle}>투어 검색 결과</Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.summary}>
        <View style={styles.summaryText}>
          <Text style={styles.summaryMain} numberOfLines={1}>{firstLine}</Text>
          <Text style={styles.summarySub} numberOfLines={1}>{secondLine}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => setPopup(true)} style={({ pressed }) => pressed && { opacity: 0.6 }}>
          <GlassChip fallbackStyle={styles.chipFallback}>
            <Text style={styles.chipText}>조건 변경</Text>
          </GlassChip>
        </Pressable>
      </View>

      <View style={styles.toolbar}>
        <Text style={styles.count}>검색 결과 {total}개</Text>
        <View style={styles.toolbarRight}>
          <Pressable accessibilityRole="button" accessibilityLabel={`정렬: ${SORT_LABELS[sort]}`} onPress={() => setSortSheet(true)} style={({ pressed }) => [styles.sortButton, pressed && { opacity: 0.6 }]}>
            <Text style={styles.sortText}>{SORT_LABELS[sort]}</Text>
            <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.7)" />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="카드형 보기" accessibilityState={{ selected: view === 'card' }} hitSlop={6} onPress={() => changeView('card')}>
            <Ionicons name="grid-outline" size={19} color={view === 'card' ? Colors.brand.white : 'rgba(255,255,255,0.35)'} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="목록형 보기" accessibilityState={{ selected: view === 'list' }} hitSlop={6} onPress={() => changeView('list')}>
            <Ionicons name="list" size={22} color={view === 'list' ? Colors.brand.white : 'rgba(255,255,255,0.35)'} />
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="rgba(255,255,255,0.5)" /></View>
      ) : error && !tours.length ? (
        <Pressable onPress={() => load('first')} style={styles.center}>
          <Text style={styles.errorText}>투어를 불러오지 못했습니다. 눌러서 다시 시도해주세요.</Text>
        </Pressable>
      ) : (
        <FlatList
          key={view}
          data={tours}
          keyExtractor={tour => String(tour.id)}
          numColumns={view === 'card' ? 2 : 1}
          columnWrapperStyle={view === 'card' ? styles.columns : undefined}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }, !tours.length && styles.listEmpty]}
          renderItem={({ item }) => view === 'card'
            ? <TourCardItem tour={item} width={cardWidth} showInstructor onPress={openTour} />
            : <TourRow tour={item} onPress={openTour} />}
          ItemSeparatorComponent={view === 'list' ? () => <View style={{ height: 8 }} /> : undefined}
          ListEmptyComponent={<TourEmpty message="검색된 투어가 없어요." />}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginTop: 12 }} color="rgba(255,255,255,0.5)" /> : undefined}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} tintColor="rgba(255,255,255,0.6)" />}
          showsVerticalScrollIndicator={false}
        />
      )}

      <TourSearchPopup
        visible={popup}
        initial={conditions}
        onClose={() => setPopup(false)}
        onSearch={next => { setPopup(false); setConditions(next); }}
      />
      <BottomSheet
        visible={sortSheet}
        onClose={() => setSortSheet(false)}
        title="정렬"
        items={sorts.map(value => ({ label: SORT_LABELS[value], value }))}
        selectedValue={sort}
        fitContent
        onSelect={setSort}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.brand.primary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 52, paddingHorizontal: SIDE },
  backButton: { width: 36, height: 36 },
  backCircle: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  backArrow: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.white, marginRight: 1 },
  headerTitle: { fontFamily: 'SUIT-Bold', fontSize: 18, color: Colors.brand.white },
  summary: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: SIDE, marginTop: 4, padding: 14,
    borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)',
  },
  summaryText: { flex: 1, gap: 3 },
  summaryMain: { fontFamily: 'SUIT-Bold', fontSize: 15, color: Colors.brand.white },
  summarySub: { fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.55)' },
  chipFallback: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.12)' },
  chipText: { fontFamily: 'SUIT-SemiBold', fontSize: 13, color: Colors.brand.white },
  toolbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SIDE, paddingTop: 16, paddingBottom: 10,
  },
  count: { fontFamily: 'SUIT-SemiBold', fontSize: 14, color: 'rgba(255,255,255,0.85)' },
  toolbarRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  sortButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sortText: { fontFamily: 'SUIT-Regular', fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  errorText: { fontFamily: 'SUIT-Regular', fontSize: 15, color: 'rgba(255,255,255,0.35)', textAlign: 'center' },
  list: { paddingHorizontal: SIDE },
  listEmpty: { flexGrow: 1 },
  columns: { gap: GAP, marginBottom: GAP },
});
