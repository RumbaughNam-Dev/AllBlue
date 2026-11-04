import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator, RefreshControl, DeviceEventEmitter } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { api, TourWish, TourWishQuery, TourWishStyle } from '@/services/api';
import BottomSheet from '@/components/BottomSheet';
import DatePickerSheet from '@/components/DatePickerSheet';
import GlassCircle from '@/components/GlassCircle';
import StripBackSlot from '@/components/StripBackSlot';
import { useAppRouter, useIsPaneRoot } from '@/features/split/SplitPane';
import { useLatestRequest } from '@/hooks/useLatestRequest';
import { localToday, TOUR_FORM_LIMITS } from './tourForm';
import { regionName, useTourRegions } from './useTourRegions';

const SIDE = 20;
const ACCENT = '#00E5FF';
type Sheet = 'continent' | 'country' | 'from' | 'to' | null;
export const WISH_STYLE_LABELS: Record<TourWishStyle, string> = { DIVING_ONLY: '오직 다이빙만', DIVING_SIGHTSEEING: '다이빙 + 관광' };
const dot = (day: string) => day.replace(/-/g, '.');
const monthLater = (day: string) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
};
const received = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// 역제안 목록 (강사 · admin): 출발일 기간 · 지역으로 검색 (기본 오늘 ~ 한 달 뒤 출발).
// 열면 그때까지 들어온 제안은 모두 확인한 것으로 저장하고, 이번에 처음 본 제안은 'NEW'로 표시.
export default function TourWishesScreen() {
  const router = useAppRouter();
  const isPaneRoot = useIsPaneRoot();
  const insets = useSafeAreaInsets();
  const today = localToday();
  const [query, setQuery] = useState<TourWishQuery>({ from: today, to: monthLater(today), continent: '', country: '' });
  const [wishes, setWishes] = useState<TourWish[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const { continents, countries, failed, reload: reloadRegions, countriesOf } = useTourRegions();
  // 화면을 처음 열기 전에 마지막으로 본 때: 이보다 뒤에 들어온 제안이 NEW (검색을 바꿔도 그대로)
  const seenBefore = useRef<string | null | undefined>(undefined);
  const request = useLatestRequest();

  const load = useCallback(async (mode: 'first' | 'refresh' = 'first') => {
    const isCurrent = request.start();
    if (mode === 'first') setLoading(true); else setRefreshing(true);
    try {
      const result = await api.getTourWishes(query);
      if (!isCurrent()) return;
      if (seenBefore.current === undefined) seenBefore.current = result.seenAt;
      setWishes(result.wishes); setError(false);
      // 보여졌으니 이때까지 들어온 제안은 확인함 → 홈 숫자 · 종 알림도 갱신
      api.markTourWishesSeen(result.loadedAt)
        .then(() => { DeviceEventEmitter.emit('tourWishesSeen'); DeviceEventEmitter.emit('notificationsChanged'); })
        .catch(() => {});
    } catch {
      if (isCurrent()) setError(true);
    } finally {
      if (isCurrent()) { setLoading(false); setRefreshing(false); }
    }
  }, [query, request]);
  useEffect(() => { void load('first'); }, [load]);

  const set = (patch: Partial<TourWishQuery>) => setQuery(prev => ({ ...prev, ...patch }));
  const isNew = (wish: TourWish) => seenBefore.current === null || (!!seenBefore.current && wish.createdAt > seenBefore.current);

  // 이 제안의 지역 · 기간 · 인원으로 투어 만들기 화면을 채움 (모집 인원은 2~20명이라 1명이면 2명)
  const createFrom = (wish: TourWish) => router.push({
    pathname: '/tour-create',
    params: {
      wishContinent: wish.continentCode, wishCountry: wish.countryCode, wishStart: wish.startDate, wishEnd: wish.endDate,
      ...(wish.headcount ? { wishCapacity: String(Math.min(TOUR_FORM_LIMITS.capacityMax, Math.max(TOUR_FORM_LIMITS.capacityMin, wish.headcount))) } : {}),
    },
  });

  const continentItems = [{ label: '전체', value: '' }, ...continents.map(c => ({ label: c.nameKo ?? c.name, value: c.code }))];
  const countryItems = [{ label: '전체', value: '' }, ...countriesOf(query.continent).map(c => ({ label: c.nameKo ?? c.name, value: c.code }))];
  const newCount = wishes.filter(isNew).length;

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
        <View style={styles.backButton} />
      </View>

      {/* 검색: 출발일 기간 · 지역 */}
      <View style={styles.filters}>
        <View style={styles.row}>
          <Ionicons name="calendar-outline" size={16} color={ACCENT} />
          <Selector label={dot(query.from)} onPress={() => setSheet('from')} />
          <Text style={styles.tilde}>~</Text>
          <Selector label={dot(query.to)} onPress={() => setSheet('to')} />
        </View>
        <View style={styles.row}>
          <Ionicons name="location-outline" size={16} color={ACCENT} />
          <Selector label={query.continent ? regionName(continents, query.continent) : '대륙 전체'} onPress={() => (failed ? reloadRegions() : setSheet('continent'))} />
          <Selector label={query.country ? regionName(countries, query.country) : '나라 전체'} disabled={!query.continent} onPress={() => setSheet('country')} />
        </View>
        <Text style={styles.filterHint}>
          출발일 기준 · {wishes.length}건{newCount > 0 ? <Text style={styles.filterNew}>  새 제안 {newCount}건</Text> : null}
        </Text>
      </View>

      {loading && !wishes.length ? (
        <View style={styles.center}><ActivityIndicator size="large" color="rgba(255,255,255,0.5)" /></View>
      ) : error && !wishes.length ? (
        <Pressable onPress={() => load('first')} style={styles.center}>
          <Text style={styles.emptyText}>제안을 불러오지 못했어요. 눌러서 다시 시도해 주세요.</Text>
        </Pressable>
      ) : (
        <FlatList
          data={wishes}
          keyExtractor={wish => String(wish.id)}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }, !wishes.length && styles.listEmpty]}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} tintColor="rgba(255,255,255,0.6)" />}
          ListEmptyComponent={(
            <View style={styles.center}>
              <Ionicons name="mail-open-outline" size={40} color="rgba(255,255,255,0.25)" />
              <Text style={styles.emptyText}>이 조건으로 들어온 제안이 없어요.</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <WishCard
              wish={item}
              isNew={isNew(item)}
              place={`${regionName(continents, item.continentCode)} · ${regionName(countries, item.countryCode)}`}
              canCreate={item.startDate >= today}
              onCreate={() => createFrom(item)}
            />
          )}
        />
      )}

      <BottomSheet
        visible={sheet === 'continent'}
        onClose={() => setSheet(null)}
        title="대륙"
        items={continentItems}
        selectedValue={query.continent}
        fitContent
        onSelect={continent => { if (continent !== query.continent) set({ continent, country: '' }); }}
      />
      <BottomSheet
        visible={sheet === 'country'}
        onClose={() => setSheet(null)}
        title={`나라 (${regionName(continents, query.continent)})`}
        items={countryItems}
        selectedValue={query.country}
        searchable={countryItems.length > 9}
        onSelect={country => set({ country })}
      />
      <DatePickerSheet
        visible={sheet === 'from'}
        onClose={() => setSheet(null)}
        selectedDate={query.from}
        onSelect={from => set({ from, to: query.to < from ? from : query.to })}
      />
      <DatePickerSheet
        visible={sheet === 'to'}
        onClose={() => setSheet(null)}
        selectedDate={query.to}
        minDate={query.from}
        onSelect={to => set({ to })}
      />
    </View>
  );
}

function WishCard({ wish, isNew, place, canCreate, onCreate }: { wish: TourWish; isNew: boolean; place: string; canCreate: boolean; onCreate: () => void }) {
  const period = wish.startDate === wish.endDate ? dot(wish.startDate) : `${dot(wish.startDate)} ~ ${dot(wish.endDate)}`;
  return (
    <View style={[styles.card, isNew ? styles.cardNew : styles.cardSeen]}>
      <View style={styles.cardTop}>
        {isNew ? (
          <View style={styles.newBadge}><Text style={styles.newBadgeText}>NEW</Text></View>
        ) : (
          <View style={styles.seenBadge}>
            <Ionicons name="checkmark" size={12} color="rgba(255,255,255,0.5)" />
            <Text style={styles.seenBadgeText}>확인함</Text>
          </View>
        )}
        <Text style={styles.cardTime}>{received(wish.createdAt)} 도착</Text>
      </View>

      <Text style={[styles.cardTitle, !isNew && styles.dim]}>
        <Text style={isNew ? styles.nickNew : undefined}>{wish.nickname}</Text>님이 투어를 원해요
      </Text>

      <View style={styles.infoGrid}>
        <Info icon="calendar-outline" text={period} strong={isNew} />
        <Info icon="location-outline" text={place} strong={isNew} />
        {wish.headcount != null && <Info icon="people-outline" text={`${wish.headcount}명 (제안자 포함)`} strong={isNew} />}
        {wish.tourStyle && <Info icon="options-outline" text={WISH_STYLE_LABELS[wish.tourStyle]} strong={isNew} />}
      </View>

      {canCreate ? (
        <Pressable accessibilityRole="button" onPress={onCreate} style={({ pressed }) => [styles.createButton, isNew && styles.createButtonNew, pressed && { opacity: 0.7 }]}>
          <Ionicons name="add-circle-outline" size={17} color={isNew ? Colors.brand.primary : Colors.brand.white} />
          <Text style={[styles.createText, isNew && styles.createTextNew]}>이 제안으로 투어 만들기</Text>
        </Pressable>
      ) : (
        <Text style={styles.departed}>출발일이 지나 투어를 만들 수 없어요</Text>
      )}
    </View>
  );
}

function Info({ icon, text, strong }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string; strong: boolean }) {
  return (
    <View style={styles.info}>
      <Ionicons name={icon} size={15} color={strong ? ACCENT : 'rgba(255,255,255,0.45)'} />
      <Text style={[styles.infoText, !strong && styles.dim]}>{text}</Text>
    </View>
  );
}

function Selector({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.selector, disabled && { opacity: 0.4 }, pressed && { opacity: 0.7 }]}
    >
      <Text style={styles.selectorText} numberOfLines={1}>{label}</Text>
      <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.5)" />
    </Pressable>
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

  filters: { paddingHorizontal: SIDE, paddingBottom: 12, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selector: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  selectorText: { flex: 1, fontFamily: 'SUIT-Regular', fontSize: 14, color: Colors.brand.white },
  tilde: { fontFamily: 'SUIT-Regular', fontSize: 15, color: 'rgba(255,255,255,0.5)' },
  filterHint: { fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  filterNew: { fontFamily: 'SUIT-Bold', color: ACCENT },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 12 },
  emptyText: { fontFamily: 'SUIT-Regular', fontSize: 15, color: 'rgba(255,255,255,0.4)', textAlign: 'center' },
  list: { paddingHorizontal: SIDE, paddingTop: 4 },
  listEmpty: { flexGrow: 1 },

  card: { borderRadius: 14, padding: 16, gap: 10, borderWidth: 1 },
  cardNew: { backgroundColor: 'rgba(0,229,255,0.09)', borderColor: 'rgba(0,229,255,0.55)' },
  cardSeen: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.08)' },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  newBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: ACCENT },
  newBadgeText: { fontFamily: 'SUIT-Bold', fontSize: 11, color: Colors.brand.primary, letterSpacing: 0.5 },
  seenBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.08)' },
  seenBadgeText: { fontFamily: 'SUIT-SemiBold', fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  cardTime: { fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.45)' },
  cardTitle: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.white },
  nickNew: { color: ACCENT },
  dim: { color: 'rgba(255,255,255,0.6)' },
  infoGrid: { gap: 6 },
  info: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { flex: 1, fontFamily: 'SUIT-SemiBold', fontSize: 14, color: Colors.brand.white },
  createButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: 10, marginTop: 2,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  createButtonNew: { backgroundColor: Colors.brand.white, borderColor: Colors.brand.white },
  createText: { fontFamily: 'SUIT-SemiBold', fontSize: 14, color: Colors.brand.white },
  createTextNew: { fontFamily: 'SUIT-Bold', color: Colors.brand.primary },
  departed: { fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 2 },
});
