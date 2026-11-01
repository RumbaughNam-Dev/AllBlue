import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, FlatList, Pressable, ActivityIndicator, RefreshControl, Platform, useWindowDimensions,
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
  const { home, loading, refreshing, error, retry, refresh } = useTourHome();
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
      <View style={styles.actions}>
        <View style={styles.actionGroup}>
          {home?.canCreate && (
            <>
              <ActionChip icon="add" label="투어 만들기" onPress={() => router.push('/tour-create')} />
              <ActionChip label="투어 관리" />
            </>
          )}
        </View>
        <ActionChip icon="search" label="투어 검색" onPress={() => setSearching(true)} />
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

function ActionChip({ icon, label, onPress = showTourComingSoon }: { icon?: 'add' | 'search'; label: string; onPress?: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.6 }}>
      <GlassChip fallbackStyle={styles.chipFallback}>
        <View style={styles.chipContent}>
          {icon && <Ionicons name={icon} size={15} color={Colors.brand.white} />}
          <Text style={styles.chipText}>{label}</Text>
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
    paddingHorizontal: SIDE,
    paddingTop: 4,
    paddingBottom: 12,
  },
  actionGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  chipFallback: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  chipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
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
