import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, RefreshControl, Image, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/Colors';
import { api, TourBannerItem } from '@/services/api';
import GlassCircle from '@/components/GlassCircle';
import StripBackSlot from '@/components/StripBackSlot';
import { useAppRouter, useIsPaneRoot } from '@/features/split/SplitPane';
import { useLatestRequest } from '@/hooks/useLatestRequest';
import { TourEmpty } from './TourCards';
import { BANNER_STATE, shortDay } from './banners';

const SIDE = 20;

// 22장 광고 배너 관리 (admin): 노출 중 · 예정 배너, 아래 '지난 광고'. 누르면 수정, '추가'로 새 배너
export default function TourBannersScreen() {
  const router = useAppRouter();
  const isPaneRoot = useIsPaneRoot();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<{ liveCount: number; max: number; banners: TourBannerItem[]; ended: TourBannerItem[] } | null>(null);
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

  const open = (banner?: TourBannerItem) => router.push({ pathname: '/tour-banner-edit', params: banner ? { id: String(banner.id) } : {} });

  const row = (banner: TourBannerItem) => {
    const state = BANNER_STATE[banner.state];
    return (
      <Pressable
        key={banner.id}
        accessibilityRole="button"
        accessibilityLabel={`${banner.tourTitle} 배너 수정, ${state.label}`}
        onPress={() => open(banner)}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
      >
        <Image source={{ uri: banner.imageUrl }} style={styles.thumb} resizeMode="cover" />
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle} numberOfLines={1}>{banner.tourTitle}</Text>
          <Text style={styles.rowMeta}>{shortDay(banner.startDate)} ~ {shortDay(banner.endDate)}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: state.color }]}><Text style={[styles.badgeText, { color: state.text }]}>{state.label}</Text></View>
      </Pressable>
    );
  };

  return (
    // 관리자 기능은 프로필 시트 안에서 열림 (다른 관리자 화면과 같은 위쪽 여백)
    <View style={[styles.container, { paddingTop: Platform.OS === 'ios' ? 10 : insets.top }]}>
      <View style={styles.header}>
        {isPaneRoot ? <View style={styles.side} /> : (
          <StripBackSlot size={36}>
            <Pressable accessibilityRole="button" accessibilityLabel="뒤로" onPress={() => router.back()} style={({ pressed }) => [styles.side, pressed && { opacity: 0.6 }]}>
              <GlassCircle fallbackStyle={styles.backCircle}>
                <Text style={styles.backArrow}>{'<'}</Text>
              </GlassCircle>
            </Pressable>
          </StripBackSlot>
        )}
        <Text style={styles.headerTitle}>광고 배너 관리</Text>
        <Pressable accessibilityRole="button" onPress={() => open()} style={({ pressed }) => [styles.addButton, pressed && { opacity: 0.7 }]}>
          <Text style={styles.addText}>추가</Text>
        </Pressable>
      </View>

      {!data && !error ? (
        <View style={styles.center}><ActivityIndicator size="large" color="rgba(255,255,255,0.5)" /></View>
      ) : error && !data ? (
        <Pressable style={styles.center} onPress={() => load()} accessibilityRole="button">
          <Text style={styles.errorText}>배너를 불러오지 못했습니다.{'\n'}눌러서 다시 시도해주세요.</Text>
        </Pressable>
      ) : data && !data.banners.length && !data.ended.length ? (
        <View style={styles.center}><TourEmpty message="등록한 배너가 없어요. '추가'로 만들어 주세요." /></View>
      ) : data && (
        <ScrollView
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="rgba(255,255,255,0.6)" />}
        >
          <Text style={styles.summary}>노출 중 {data.liveCount}개 · 최대 {data.max}개 · 홈에서는 매번 순서 랜덤</Text>
          <View style={styles.group}>{data.banners.map(row)}</View>
          {data.ended.length > 0 && (
            <>
              <Text style={styles.section}>지난 광고</Text>
              <View style={styles.group}>{data.ended.map(row)}</View>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.brand.primary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 52, paddingHorizontal: SIDE },
  side: { width: 36, height: 36 },
  backCircle: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  backArrow: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.white, marginRight: 1 },
  headerTitle: { fontFamily: 'SUIT-Bold', fontSize: 18, color: Colors.brand.white },
  addButton: { height: 32, paddingHorizontal: 14, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#00B4D8' },
  addText: { fontFamily: 'SUIT-Bold', fontSize: 14, color: '#032A36' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  errorText: { fontFamily: 'SUIT-Regular', fontSize: 15, color: 'rgba(255,255,255,0.35)', textAlign: 'center' },
  list: { paddingHorizontal: SIDE },
  summary: { fontFamily: 'SUIT-Regular', fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 4, marginBottom: 12 },
  section: { fontFamily: 'SUIT-Bold', fontSize: 15, color: Colors.brand.white, marginTop: 24, marginBottom: 10 },
  group: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)' },
  thumb: { width: 112, height: 63, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.08)' },
  rowBody: { flex: 1, gap: 6 },
  rowTitle: { fontFamily: 'SUIT-Bold', fontSize: 15, color: Colors.brand.white },
  rowMeta: { fontFamily: 'SUIT-Regular', fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { fontFamily: 'SUIT-Bold', fontSize: 11 },
});
