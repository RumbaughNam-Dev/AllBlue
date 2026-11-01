import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, FlatList, Pressable, Image, ActivityIndicator, RefreshControl, Platform, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import GlassChip from '@/components/GlassChip';
import { useAppRouter, usePaneDefault } from '@/features/split/SplitPane';
import { DUO_SYSTEM_TABS } from '@/utils/foldable';
import { getTabBarContentClearance, getSideStripBottomGap, hasSideTabStrip } from '@/utils/tabBarLayout';
import type { TourCard } from '@/services/api';
import TourBanner from './TourBanner';
import { TOUR_STATUS, formatRecruitment, formatTourPeriod, showTourComingSoon } from './ui';
import { useTourHome } from './useTourHome';

const SIDE = 20;
const CARD_WIDTH = 148;

// 투어 홈: 위에 버튼 줄(고정), 아래로 광고 배너 · 최근 등록된 투어 · 최근 관심이 많은 투어.
export default function TourHomeScreen() {
  const { home, loading, refreshing, error, retry, refresh } = useTourHome();
  const router = useAppRouter();
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
        <ActionChip icon="search" label="투어 검색" />
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
            <View style={styles.emptyArea}>
              <Text style={styles.logo}>all<Text style={styles.logoAccent}>b</Text>lue</Text>
              <Text style={styles.emptyMessage}>등록된 투어가 없어요.</Text>
            </View>
          ) : (
            <>
              {!!home?.banners.length && bannerWidth > 0 && (
                <View style={styles.bannerArea}>
                  <TourBanner banners={home.banners} width={bannerWidth} height={bannerHeight} onPress={showTourComingSoon} />
                </View>
              )}
              {!!home?.recent.length && (
                <>
                  <SectionHeader title="최근 등록된 투어" />
                  <FlatList
                    data={home.recent}
                    keyExtractor={tour => String(tour.id)}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.cardList}
                    renderItem={({ item }) => <TourCardItem tour={item} />}
                  />
                </>
              )}
              {!!home?.popular.length && (
                <>
                  <SectionHeader title="최근 관심이 많은 투어" />
                  <View style={styles.rows}>
                    {home.popular.map(tour => <TourRow key={tour.id} tour={tour} />)}
                  </View>
                </>
              )}
            </>
          )}
        </ScrollView>
      )}
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

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Pressable onPress={showTourComingSoon} hitSlop={8} style={({ pressed }) => pressed && { opacity: 0.6 }}>
        <Text style={styles.seeAll}>전체보기 ›</Text>
      </Pressable>
    </View>
  );
}

function StatusBadge({ status }: { status: TourCard['status'] }) {
  const meta = TOUR_STATUS[status];
  if (!meta) return null;
  return (
    <View style={[styles.badge, { backgroundColor: meta.color }]}>
      <Text style={[styles.badgeText, { color: meta.text }]}>{meta.label}</Text>
    </View>
  );
}

function Thumbnail({ uri, style }: { uri: string | null; style: object }) {
  if (uri) return <Image source={{ uri }} style={style} resizeMode="cover" />;
  return (
    <View style={[style, styles.noImage]}>
      <Ionicons name="airplane-outline" size={22} color="rgba(255,255,255,0.3)" />
    </View>
  );
}

function TourCardItem({ tour }: { tour: TourCard }) {
  return (
    <Pressable onPress={showTourComingSoon} style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}>
      <View>
        <Thumbnail uri={tour.imageUrl} style={styles.cardImage} />
        <View style={styles.cardBadge}><StatusBadge status={tour.status} /></View>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.title} numberOfLines={1}>{tour.title}</Text>
        {/* Narrow card: country and dates on their own lines so neither gets cut off */}
        <Text style={styles.meta} numberOfLines={1}>{tour.countryName}</Text>
        <Text style={styles.meta} numberOfLines={1}>{formatTourPeriod(tour.startDate, tour.endDate)}</Text>
        <Text style={styles.recruit}>{formatRecruitment(tour.recruitedCount, tour.capacity)}</Text>
      </View>
    </Pressable>
  );
}

function TourRow({ tour }: { tour: TourCard }) {
  return (
    <Pressable onPress={showTourComingSoon} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
      <Thumbnail uri={tour.imageUrl} style={styles.rowImage} />
      <View style={styles.rowBody}>
        <Text style={styles.title} numberOfLines={1}>{tour.title}</Text>
        <Text style={styles.meta} numberOfLines={1}>{tour.countryName} · {formatTourPeriod(tour.startDate, tour.endDate)}</Text>
        <Text style={styles.meta} numberOfLines={1}>by {tour.instructor.nickname}</Text>
      </View>
      <View style={styles.rowSide}>
        <StatusBadge status={tour.status} />
        <Text style={styles.recruit}>{formatRecruitment(tour.recruitedCount, tour.capacity)}</Text>
      </View>
    </Pressable>
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
  card: {
    width: CARD_WIDTH,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  cardImage: {
    width: CARD_WIDTH,
    height: CARD_WIDTH * 3 / 4,
  },
  cardBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  cardBody: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 3,
  },
  rows: {
    paddingHorizontal: SIDE,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  rowImage: {
    width: 64,
    height: 64,
    borderRadius: 8,
  },
  rowBody: {
    flex: 1,
    gap: 3,
  },
  rowSide: {
    alignItems: 'flex-end',
    gap: 8,
  },
  noImage: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  title: {
    fontFamily: 'SUIT-Bold',
    fontSize: 14,
    color: Colors.brand.white,
  },
  meta: {
    fontFamily: 'SUIT-Regular',
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
  },
  recruit: {
    fontFamily: 'SUIT-SemiBold',
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: {
    fontFamily: 'SUIT-Bold',
    fontSize: 11,
  },
  emptyArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  // Same face and spacing as the toolbar logo (SUIT-Regular, letterSpacing 4 at 20pt), scaled up.
  logo: {
    fontFamily: 'SUIT-Regular',
    fontSize: 34,
    letterSpacing: 34 * (4 / 20),
    color: Colors.brand.white,
  },
  logoAccent: {
    color: '#00E5FF',
  },
  emptyMessage: {
    fontFamily: 'SUIT-SemiBold',
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
  },
  emptyText: {
    fontFamily: 'SUIT-Regular',
    fontSize: 15,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
  },
});
