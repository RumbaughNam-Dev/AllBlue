import React, { useCallback, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/Colors';
import { CenterMessage } from '@/features/community/ui';
import { useLatestRequest } from '@/hooks/useLatestRequest';
import { api, type TourBannerItem } from '@/services/api';
import { HeaderButton, TourHeader } from './FormParts';
import { Badge, TourEmpty, TourGrid, useGridWidth } from './TourCards';
import { BANNER_STATE, shortDay } from './banners';
import { useSheetTop } from './useSheetTop';
import { useTourRouter } from './nav';

const SIDE = 20;
type Banners = { liveCount: number; max: number; banners: TourBannerItem[]; ended: TourBannerItem[] };

// 19장 광고 배너 관리 (admin): 노출 중 · 예정 배너, 아래 '지난 광고'. 한 줄에 2개 (펼친 화면 4개), 누르면 수정, '추가'로 새 배너
export default function TourBannersScreen() {
  const router = useTourRouter();
  const insets = useSafeAreaInsets();
  const { top, inSheet } = useSheetTop();
  const grid = useGridWidth();
  const [data, setData] = useState<Banners | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const latest = useLatestRequest();

  const load = useCallback(async (refresh = false) => {
    const isCurrent = latest.start();
    if (refresh) setRefreshing(true);
    try {
      const result = await api.getTourBanners();
      if (isCurrent()) { setData(result); setError(false); }
    } catch {
      if (isCurrent()) setError(true);
    } finally {
      if (isCurrent()) setRefreshing(false);
    }
  }, [latest]);
  // 수정하고 돌아오면 다시 불러옴
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const open = (banner?: TourBannerItem) => router.push({ pathname: '/tour-banner-edit', params: banner ? { id: String(banner.id), inSheet } : { inSheet } });

  const card = (banner: TourBannerItem) => {
    const state = BANNER_STATE[banner.state];
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={`${banner.tourName} 배너 수정, ${state.label}`} onPress={() => open(banner)}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.75 }]}>
        <View style={{ width: grid.cardWidth, height: Math.round((grid.cardWidth * 9) / 16) }}>
          <Image source={{ uri: banner.imageUrl }} style={styles.image} resizeMode="cover" />
          <View style={styles.badge}><Badge {...state} small /></View>
        </View>
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>{banner.tourName}</Text>
          <Text style={styles.meta}>{shortDay(banner.startDate)} ~ {shortDay(banner.endDate)}</Text>
        </View>
      </Pressable>
    );
  };

  const empty = data && !data.banners.length && !data.ended.length;
  return (
    <View style={[styles.screen, { paddingTop: top }]}>
      <TourHeader title="광고 배너 관리" onBack={() => router.back()} right={<HeaderButton label="추가" primary onPress={() => open()} />} />
      {!data ? <CenterMessage loading={!error} message="배너를 불러오지 못했어요." onRetry={() => void load()} /> : (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }, empty && { flexGrow: 1 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor="rgba(255,255,255,0.6)" />}>
          {empty ? <TourEmpty message="등록한 배너가 없어요." /> : (
            <View onLayout={grid.onLayout}>
              <Text style={styles.summary}>노출 중 {data.liveCount}개 · 최대 {data.max}개 · 홈에서는 매번 순서 랜덤</Text>
              <TourGrid items={data.banners} cardWidth={grid.cardWidth} keyOf={b => b.id} renderItem={card} />
              {data.ended.length ? (
                <>
                  <Text style={styles.section}>지난 광고</Text>
                  <TourGrid items={data.ended} cardWidth={grid.cardWidth} keyOf={b => b.id} renderItem={card} />
                </>
              ) : null}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.brand.primary },
  scroll: { paddingHorizontal: SIDE, paddingTop: 4 },
  summary: { fontFamily: 'SUIT-Regular', fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 12 },
  section: { fontFamily: 'SUIT-Bold', fontSize: 15, color: Colors.brand.white, marginTop: 24, marginBottom: 10 },
  card: { borderRadius: 14, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.1)' },
  image: { width: '100%', height: '100%', backgroundColor: 'rgba(255,255,255,0.08)' },
  badge: { position: 'absolute', top: 8, left: 8 },
  body: { paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10, gap: 3 },
  title: { fontFamily: 'SUIT-Bold', fontSize: 14, color: Colors.brand.white },
  meta: { fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.6)' },
});
