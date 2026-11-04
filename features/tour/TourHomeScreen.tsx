import React, { useEffect, useState } from 'react';
import {
  DeviceEventEmitter, View, Text, StyleSheet, ScrollView, FlatList, Pressable, ActivityIndicator, RefreshControl, Platform, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import GlassChip from '@/components/GlassChip';
import { useAppRouter, usePaneDefault } from '@/features/split/SplitPane';
import { DUO_SYSTEM_TABS } from '@/utils/foldable';
import { getTabBarContentClearance, getSideStripBottomGap, hasSideTabStrip } from '@/utils/tabBarLayout';
import type { TourCard, TourSearchConditions, TourSort } from '@/services/api';
import TourBanner from './TourBanner';
import { showTourComingSoon } from './ui';
import { TourCardItem, TourEmpty, TourRow } from './TourCards';
import TourSearchPopup, { EMPTY_SEARCH } from './TourSearchPopup';
import { useTourHome } from './useTourHome';

const SIDE = 20;

// 투어 홈: 위에 버튼 줄(고정), 아래로 광고 배너 · 최근 등록된 투어 · 최근 관심이 많은 투어.
export default function TourHomeScreen() {
  const { home, loading, refreshing, error, retry, refresh, reload } = useTourHome();
  // 역제안 목록을 보고 나면 숫자를 다시 받아옴 (펼친 화면에서는 홈이 계속 보이고 있어서)
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('tourWishesSeen', () => { void reload(); });
    return () => sub.remove();
  }, [reload]);
  const router = useAppRouter();
  const [searching, setSearching] = useState(false);
  // 카드 · 배너를 누르면 투어 상세 (펼친 화면이면 오른쪽 칸)
  const openTour = (tourId: number) => router.push({ pathname: '/tour-detail', params: { id: String(tourId) } });
  const openCard = (tour: TourCard) => openTour(tour.id);
  // 검색 · 전체보기는 같은 결과 화면 (펼친 화면이면 오른쪽 칸)
  const openResults = (conditions: TourSearchConditions, sort: TourSort) => router.push({
    pathname: '/tour-search',
    params: { ...Object.fromEntries(Object.entries(conditions).filter(([, v]) => v)), sort },
  });
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [width, setWidth] = useState(0);
  usePaneDefault('tour', { message: '투어를 고르면 여기에 보여요', hint: '왼쪽에서 궁금한 투어를 눌러 보세요' });
  const bottomSpace = DUO_SYSTEM_TABS ? insets.bottom : hasSideTabStrip(insets.right, Platform.OS) ? getSideStripBottomGap(insets.bottom) : getTabBarContentClearance(insets.bottom, Platform.OS);

  // 가로 16:9, 화면 높이의 1/3을 넘지 않게
  const bannerWidth = Math.max(0, width - SIDE * 2);
  const bannerHeight = Math.min(bannerWidth * 9 / 16, windowHeight / 3);
  const empty = home && !home.banners.length && !home.recent.length && !home.popular.length;

  return (
    <View style={styles.container} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {/* 왼쪽: 누구나 쓰는 주요 버튼 하나(투어 역제안), 오른쪽: 도구 아이콘 (강사 · admin은 받은 제안 · 만들기 · 관리 + 검색) */}
      <View style={styles.actions}>
        <ActionChip icon="hand-left" label="투어 만들어 주세요" prominent onPress={() => router.push('/tour-wish')} />
        <View style={styles.actionGroup}>
          {home?.canCreate && (
            <>
              {/* 들어온 역제안 목록, 빨간 숫자는 아직 안 본 제안 */}
              <IconChip icon="mail-unread-outline" label="받은 제안" count={home.wishNew ?? 0} onPress={() => router.push('/tour-wishes')} />
              <IconChip icon="add" label="투어 만들기" onPress={() => router.push('/tour-create')} />
              <IconChip icon="settings-sharp" label="투어 관리" onPress={() => router.push('/tour-manage')} />
            </>
          )}
          <IconChip icon="search" label="투어 검색" onPress={() => setSearching(true)} />
        </View>
      </View>

      {loading && !home ? (
        <View style={styles.center}><ActivityIndicator size="large" color="rgba(255,255,255,0.5)" /></View>
      ) : error && !home ? (
        <Pressable onPress={retry} style={styles.center}>
          <Text style={styles.emptyText}>투어를 불러오지 못했습니다. 눌러서 다시 시도해주세요.</Text>
        </Pressable>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: bottomSpace + 20 }, empty && styles.scrollEmpty]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="rgba(255,255,255,0.6)" />}
        >
          {empty ? (
            <TourEmpty message="등록된 투어가 없어요." />
          ) : (
            <>
              {!!home?.banners.length && bannerWidth > 0 && (
                <View style={styles.bannerArea}>
                  <TourBanner banners={home.banners} width={bannerWidth} height={bannerHeight} onPress={banner => openTour(banner.tourId)} />
                </View>
              )}
              {!!home?.recent.length && (
                <>
                  <SectionHeader title="최근 등록된 투어" onSeeAll={() => openResults(EMPTY_SEARCH, 'RECENT')} />
                  <FlatList
                    data={home.recent}
                    keyExtractor={tour => String(tour.id)}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.cardList}
                    renderItem={({ item }) => <TourCardItem tour={item} onPress={openCard} />}
                  />
                </>
              )}
              {!!home?.popular.length && (
                <>
                  <SectionHeader title="최근 관심이 많은 투어" onSeeAll={() => openResults(EMPTY_SEARCH, 'POPULAR')} />
                  <View style={styles.rows}>
                    {home.popular.map(tour => <TourRow key={tour.id} tour={tour} onPress={openCard} />)}
                  </View>
                </>
              )}
            </>
          )}
        </ScrollView>
      )}
      <TourSearchPopup
        visible={searching}
        initial={EMPTY_SEARCH}
        onClose={() => setSearching(false)}
        onSearch={conditions => { setSearching(false); openResults(conditions, 'DEADLINE'); }}
      />
    </View>
  );
}

// 글자 없이 아이콘만 있는 동그란 칩 (읽어주기용 이름은 label). count가 있으면 오른쪽 위에 빨간 숫자
function IconChip({ icon, label, count = 0, onPress }: {
  icon: 'add' | 'settings-sharp' | 'search' | 'mail-unread-outline'; label: string; count?: number; onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={count > 0 ? `${label} ${count}건` : label} onPress={onPress} hitSlop={4} style={({ pressed }) => pressed && { opacity: 0.6 }}>
      <GlassChip fallbackStyle={[styles.chipFallback, styles.iconChip]} style={styles.iconChip}>
        <Ionicons name={icon} size={icon === 'add' ? 18 : 16} color={Colors.brand.white} />
      </GlassChip>
      {count > 0 && <View style={styles.count} pointerEvents="none"><Text style={styles.countText}>{count > 99 ? '99+' : count}</Text></View>}
    </Pressable>
  );
}

// 글자 칩. prominent면 흰 바탕 · 남색 글자 (화면의 주요 버튼)
function ActionChip({ icon, label, prominent = false, onPress = showTourComingSoon }: { icon?: 'hand-left'; label: string; prominent?: boolean; onPress?: () => void }) {
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

function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Pressable onPress={onSeeAll} hitSlop={8} style={({ pressed }) => pressed && { opacity: 0.6 }}>
        <Text style={styles.seeAll}>전체보기 ›</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brand.primary,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: SIDE,
    paddingTop: 4,
    paddingBottom: 12,
  },
  // 오른쪽 아이콘 묶음 (강사 · admin 4개도 360pt 폰에서 한 줄)
  actionGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  chipProminent: { backgroundColor: Colors.brand.white },
  chipFallback: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  // 글자 칩과 같은 높이의 동그라미
  iconChip: {
    width: 34,
    height: 34,
    paddingVertical: 0,
    paddingHorizontal: 0,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  count: {
    position: 'absolute', top: -4, right: -4,
    minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#FF4D4F',
  },
  countText: { fontFamily: 'SUIT-Bold', fontSize: 11, color: Colors.brand.white },
  chipText: {
    fontFamily: 'SUIT-SemiBold',
    fontSize: 13,
    color: Colors.brand.white,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  scroll: {
    paddingTop: 4,
  },
  scrollEmpty: {
    flexGrow: 1,
  },
  bannerArea: {
    paddingHorizontal: SIDE,
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIDE,
    paddingTop: 18,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontFamily: 'SUIT-Bold',
    fontSize: 16,
    color: Colors.brand.white,
  },
  seeAll: {
    fontFamily: 'SUIT-Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  cardList: {
    paddingHorizontal: SIDE,
    gap: 10,
  },
  rows: {
    paddingHorizontal: SIDE,
    gap: 8,
  },
  emptyText: {
    fontFamily: 'SUIT-Regular',
    fontSize: 15,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
  },
});
