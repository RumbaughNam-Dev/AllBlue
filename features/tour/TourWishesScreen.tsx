import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, FlatList, ActivityIndicator, RefreshControl, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { api, TourWish } from '@/services/api';
import GlassCircle from '@/components/GlassCircle';
import StripBackSlot from '@/components/StripBackSlot';
import { useAppRouter, useIsPaneRoot } from '@/features/split/SplitPane';
import { localToday } from './tourForm';
import { regionName, useTourRegions } from './useTourRegions';
import { markWishesSeen, styles, WishCard, wishCreateParams } from './TourWishSearchScreen';

const KEEP_MAX = 100; // 화면에 들고 있는 최대 개수 (넘으면 반대쪽을 10개씩 덜어냄)
const TRIM = 10;

// 투어 제안 목록 (강사 · admin): 최근 들어온 순으로 10개씩, 아래로 내리면 10개씩 더.
// 100개가 넘으면 위쪽 10개를 덜어내고, 다시 올라가면 그만큼 다시 받아 옴 (너무 많이 그리지 않게).
// 오른쪽 위 돋보기 → 출발일 기간 · 지역으로 검색. 열면 그때까지 들어온 제안은 확인한 것으로 저장 (이번에 처음 본 제안은 NEW)
export default function TourWishesScreen() {
  const router = useAppRouter();
  const isPaneRoot = useIsPaneRoot();
  const insets = useSafeAreaInsets();
  const today = localToday();
  const { continents, countries } = useTourRegions();
  const [wishes, setWishes] = useState<TourWish[]>([]);
  const [hasOlder, setHasOlder] = useState(false); // 아래쪽(더 예전)에 더 있음
  const [hasNewer, setHasNewer] = useState(false); // 위쪽을 덜어냈음 (다시 올라가면 받아 옴)
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [more, setMore] = useState<'older' | 'newer' | null>(null);
  const busy = useRef(false);
  const generation = useRef(0); // 새로고침하면 그 전에 보낸 더 받기 결과는 버림
  const seenBefore = useRef<string | null | undefined>(undefined);
  const latest = useRef({ wishes, hasOlder, hasNewer });
  latest.current = { wishes, hasOlder, hasNewer };

  const loadFirst = useCallback(async (mode: 'first' | 'refresh') => {
    const gen = ++generation.current;
    busy.current = false;
    if (mode === 'first') setLoading(true); else setRefreshing(true);
    try {
      const result = await api.getRecentTourWishes();
      if (gen !== generation.current) return;
      if (seenBefore.current === undefined) seenBefore.current = result.seenAt;
      setWishes(result.wishes); setHasOlder(result.hasMore); setHasNewer(false); setError(false);
      markWishesSeen(result.loadedAt);
    } catch {
      if (gen === generation.current) setError(true);
    } finally {
      if (gen === generation.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);
  useEffect(() => { void loadFirst('first'); }, [loadFirst]);

  // 아래 끝: 더 예전 10개를 붙이고, 100개가 넘으면 위쪽 10개를 덜어냄
  const loadOlder = async () => {
    const { wishes: list, hasOlder: more } = latest.current;
    if (busy.current || !more || !list.length) return;
    busy.current = true; setMore('older');
    const gen = generation.current;
    try {
      const result = await api.getRecentTourWishes({ before: list[list.length - 1].id });
      if (gen !== generation.current) return;
      setWishes(prev => {
        const next = [...prev, ...result.wishes.filter(w => !prev.some(p => p.id === w.id))];
        if (next.length <= KEEP_MAX) return next;
        setHasNewer(true);
        return next.slice(next.length - KEEP_MAX >= TRIM ? next.length - KEEP_MAX : TRIM);
      });
      setHasOlder(result.hasMore);
    } catch { /* 다음에 다시 내리면 재시도 */ } finally {
      if (gen === generation.current) { busy.current = false; setMore(null); }
    }
  };

  // 위 끝 (덜어낸 적이 있을 때): 더 최근 10개를 다시 받아 위에 붙이고, 100개가 넘으면 아래쪽 10개를 덜어냄
  const loadNewer = async () => {
    const { wishes: list, hasNewer: more } = latest.current;
    if (busy.current || !more || !list.length) return;
    busy.current = true; setMore('newer');
    const gen = generation.current;
    try {
      const result = await api.getRecentTourWishes({ after: list[0].id });
      if (gen !== generation.current) return;
      setWishes(prev => {
        const next = [...result.wishes.filter(w => !prev.some(p => p.id === w.id)), ...prev];
        if (next.length <= KEEP_MAX) return next;
        setHasOlder(true);
        return next.slice(0, Math.min(KEEP_MAX, next.length - TRIM));
      });
      setHasNewer(result.hasMore);
    } catch { /* 다음에 다시 올리면 재시도 */ } finally {
      if (gen === generation.current) { busy.current = false; setMore(null); }
    }
  };

  const isNew = (wish: TourWish) => seenBefore.current === null || (!!seenBefore.current && wish.createdAt > seenBefore.current);
  const newCount = wishes.filter(isNew).length;
  const openSearch = () => router.push({ pathname: '/tour-wish-search', params: { seenBefore: seenBefore.current ?? '' } });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
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
        <Text style={styles.headerTitle}>투어 제안 목록</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="투어 제안 검색" hitSlop={8} onPress={openSearch} style={({ pressed }) => [styles.backButton, local.search, pressed && { opacity: 0.6 }]}>
          <Ionicons name="search" size={22} color={Colors.brand.white} />
        </Pressable>
      </View>
      <View style={styles.filters}>
        <Text style={styles.filterHint}>
          최근 들어온 순 · 출발 전 제안{newCount > 0 ? <Text style={styles.filterNew}>  새 제안 {newCount}건</Text> : null}
        </Text>
      </View>

      {loading && !wishes.length ? (
        <View style={styles.center}><ActivityIndicator size="large" color="rgba(255,255,255,0.5)" /></View>
      ) : error && !wishes.length ? (
        <Pressable onPress={() => loadFirst('first')} style={styles.center}>
          <Text style={styles.emptyText}>제안을 불러오지 못했어요. 눌러서 다시 시도해 주세요.</Text>
        </Pressable>
      ) : (
        <FlatList
          data={wishes}
          keyExtractor={wish => String(wish.id)}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }, !wishes.length && styles.listEmpty]}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          onEndReached={loadOlder}
          onEndReachedThreshold={0.5}
          onStartReached={loadNewer}
          onStartReachedThreshold={0.5}
          // 위쪽을 덜어내거나 붙여도 보고 있던 카드가 그 자리에 머물게
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          windowSize={7}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadFirst('refresh')} tintColor="rgba(255,255,255,0.6)" />}
          ListHeaderComponent={more === 'newer' ? <ActivityIndicator style={local.more} color="rgba(255,255,255,0.6)" /> : undefined}
          ListFooterComponent={more === 'older' ? <ActivityIndicator style={local.more} color="rgba(255,255,255,0.6)" /> : undefined}
          ListEmptyComponent={(
            <View style={styles.center}>
              <Ionicons name="mail-open-outline" size={40} color="rgba(255,255,255,0.25)" />
              <Text style={styles.emptyText}>아직 들어온 제안이 없어요.</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <WishCard
              wish={item}
              isNew={isNew(item)}
              place={`${regionName(continents, item.continentCode)} · ${regionName(countries, item.countryCode)}`}
              canCreate={item.startDate > today}
              onCreate={() => router.push({ pathname: '/tour-create', params: wishCreateParams(item) })}
              onOpenMine={() => item.myTourId && router.push({ pathname: '/tour-detail', params: { id: String(item.myTourId) } })}
            />
          )}
        />
      )}
    </View>
  );
}

const local = StyleSheet.create({
  search: { alignItems: 'center', justifyContent: 'center' },
  more: { paddingVertical: 14 },
});
