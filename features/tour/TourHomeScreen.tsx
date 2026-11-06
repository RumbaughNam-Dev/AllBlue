import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  DeviceEventEmitter, View, Text, StyleSheet, ScrollView, FlatList, Pressable, ActivityIndicator, RefreshControl, Platform, useWindowDimensions,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import GlassChip from '@/components/GlassChip';
import { useAppRouter, usePaneDefault } from '@/features/split/SplitPane';
import { DUO_SYSTEM_TABS } from '@/utils/foldable';
import { getTabBarContentClearance, getSideStripBottomGap, hasSideTabStrip } from '@/utils/tabBarLayout';
import { api, type TourCard, type TourHome } from '@/services/api';
import TourBanner from './TourBanner';
import { TourEmpty, TourPhotoCard } from './TourCards';
import { GRID_GAP, gridColumns } from './ui';
import { TOURS_CHANGED } from './nav';

const SIDE = 20;

// 3장 투어 홈: 위 버튼 줄(고정) · 광고 최대 5개 · '참여자 모집중' · '인솔자 모집중' 두 줄 (가로 스크롤, 최근 등록 순 10개)
export default function TourHomeScreen() {
  const appRouter = useAppRouter(); // 상세는 펼친 화면이면 오른쪽 칸
  const router = useRouter(); // 등록 · 내 투어 · 검색 · 전체보기는 전체 화면 (24장)
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [width, setWidth] = useState(0);
  const [home, setHome] = useState<TourHome | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [refreshing, setRefreshing] = useState(false);
  usePaneDefault('tour', { message: '투어를 고르면 여기에 보여요', hint: '왼쪽에서 궁금한 투어를 눌러 보세요' });

  const load = useCallback(async (mode: 'first' | 'refresh' | 'quiet' = 'quiet') => {
    if (mode === 'refresh') setRefreshing(true);
    try {
      setHome(await api.getTourHome());
      setState('ready');
    } catch {
      setState(prev => (prev === 'ready' ? prev : 'error'));
    } finally {
      setRefreshing(false);
    }
  }, []);
  const first = useRef(true);
  useFocusEffect(useCallback(() => { void load(first.current ? 'first' : 'quiet'); first.current = false; }, [load]));
  // 펼친 화면에선 홈이 계속 보여서, 투어가 바뀌면 바로 다시 받음
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(TOURS_CHANGED, () => { void load(); });
    return () => sub.remove();
  }, [load]);

  const openTour = (tourId: number) => appRouter.push({ pathname: '/tour-detail', params: { id: String(tourId) } });
  const bottomSpace = DUO_SYSTEM_TABS ? insets.bottom : hasSideTabStrip(insets.right, Platform.OS) ? getSideStripBottomGap(insets.bottom) : getTabBarContentClearance(insets.bottom, Platform.OS);

  // 광고: 가로 16:9, 화면 높이의 1/3을 넘지 않게
  const inner = Math.max(0, width - SIDE * 2);
  const bannerHeight = Math.min(inner * 9 / 16, windowHeight / 3);
  // 줄 카드: 바형에선 2개와 다음 카드가 조금 보이게 (넓으면 4개)
  const columns = gridColumns(inner);
  const cardWidth = inner ? Math.floor((inner - GRID_GAP * columns) / (columns + 0.25)) : 0;
  const empty = home && !home.banners.length && !home.recruiting.length && !home.seeking.length;

  return (
    <View style={styles.container} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      <View style={styles.actions}>
        <View style={styles.actionGroup}>
          <ActionChip icon="add" label="투어 등록" prominent onPress={() => router.push('/tour-register')} />
          <ActionChip label="내 투어" onPress={() => router.push('/tour-mine')} />
        </View>
        <ActionChip icon="search" label="투어 검색" onPress={() => router.push('/tour-search')} />
      </View>

      {state === 'loading' && !home ? (
        <View style={styles.center}><ActivityIndicator size="large" color="rgba(255,255,255,0.5)" /></View>
      ) : state === 'error' && !home ? (
        <Pressable onPress={() => void load('first')} style={styles.center}>
          <Text style={styles.emptyText}>투어를 불러오지 못했어요. 눌러서 다시 시도해 주세요.</Text>
        </Pressable>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: bottomSpace + 20 }, empty && styles.scrollEmpty]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load('refresh')} tintColor="rgba(255,255,255,0.6)" />}
        >
          {empty ? <TourEmpty message="등록된 투어가 없어요." /> : (
            <>
              {!!home?.banners.length && inner > 0 && (
                <View style={styles.bannerArea}>
                  <TourBanner banners={home.banners} width={inner} height={bannerHeight} onPress={banner => openTour(banner.tourId)} />
                </View>
              )}
              <Row title="참여자 모집중" tours={home?.recruiting ?? []} cardWidth={cardWidth} emptyText="지금 모집 중인 투어가 없어요."
                onSeeAll={() => router.push({ pathname: '/tour-list', params: { status: 'RECRUITING' } })} onOpen={openTour} />
              <Row title="인솔자 모집중" tours={home?.seeking ?? []} cardWidth={cardWidth} emptyText="인솔 강사님을 찾는 투어가 없어요."
                onSeeAll={() => router.push({ pathname: '/tour-list', params: { status: 'SEEKING_LEADER' } })} onOpen={openTour} />
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function Row({ title, tours, cardWidth, emptyText, onSeeAll, onOpen }: {
  title: string; tours: TourCard[]; cardWidth: number; emptyText: string; onSeeAll: () => void; onOpen: (id: number) => void;
}) {
  return (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {tours.length ? (
          <Pressable onPress={onSeeAll} hitSlop={8} style={({ pressed }) => pressed && { opacity: 0.6 }}>
            <Text style={styles.seeAll}>전체보기 ›</Text>
          </Pressable>
        ) : null}
      </View>
      {tours.length && cardWidth ? (
        <FlatList
          data={tours}
          keyExtractor={tour => String(tour.id)}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cardList}
          renderItem={({ item }) => <TourPhotoCard tour={item} width={cardWidth} onPress={() => onOpen(item.id)} />}
        />
      ) : <Text style={styles.rowEmpty}>{emptyText}</Text>}
    </>
  );
}

// 글자 칩. prominent면 흰 바탕 · 남색 글자 (화면의 주요 버튼)
function ActionChip({ icon, label, prominent = false, onPress }: { icon?: 'add' | 'search'; label: string; prominent?: boolean; onPress: () => void }) {
  const color = prominent ? Colors.brand.primary : Colors.brand.white;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.6 }}>
      <GlassChip prominent={prominent} fallbackStyle={[styles.chipFallback, prominent && styles.chipProminent]}>
        <View style={styles.chipContent}>
          {icon && <Ionicons name={icon} size={15} color={color} />}
          <Text style={[styles.chipText, { color }]}>{label}</Text>
        </View>
      </GlassChip>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.brand.primary },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: SIDE, paddingTop: 4, paddingBottom: 12 },
  actionGroup: { flexDirection: 'row', gap: 8 },
  chipProminent: { backgroundColor: Colors.brand.white },
  chipFallback: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.12)' },
  chipContent: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chipText: { fontFamily: 'SUIT-SemiBold', fontSize: 13, color: Colors.brand.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  scroll: { paddingTop: 4 },
  scrollEmpty: { flexGrow: 1 },
  bannerArea: { paddingHorizontal: SIDE, marginBottom: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SIDE, paddingTop: 18, paddingBottom: 12 },
  sectionTitle: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.white },
  seeAll: { fontFamily: 'SUIT-Regular', fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  cardList: { paddingHorizontal: SIDE, gap: GRID_GAP },
  rowEmpty: { paddingHorizontal: SIDE, fontFamily: 'SUIT-Regular', fontSize: 13, color: 'rgba(255,255,255,0.4)' },
  emptyText: { fontFamily: 'SUIT-Regular', fontSize: 15, color: 'rgba(255,255,255,0.35)', textAlign: 'center' },
});
