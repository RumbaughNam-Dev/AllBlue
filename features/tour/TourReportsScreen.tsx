import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator, RefreshControl, Image } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { api, TourReportGroup } from '@/services/api';
import GlassCircle from '@/components/GlassCircle';
import StripBackSlot from '@/components/StripBackSlot';
import { useAppRouter, useIsPaneRoot } from '@/features/split/SplitPane';
import { useLatestRequest } from '@/hooks/useLatestRequest';
import { useSheetTop } from './useSheetTop';
import { TourEmpty } from './TourCards';
import { confirmDismissReports, formatRequestedAt, sendTakeDown } from './requests';
import ReviewNotePopup from './ReviewNotePopup';

const SIDE = 20;
// 19장 투어 신고 처리 (admin): 투어별로 묶어 신고 수 · 사유, 신고 많은 순. 카드를 누르면 투어 상세
export default function TourReportsScreen() {
  const router = useAppRouter();
  const isPaneRoot = useIsPaneRoot();
  const insets = useSafeAreaInsets();
  const { top: sheetTop, inSheet } = useSheetTop();
  const [groups, setGroups] = useState<TourReportGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [takingDown, setTakingDown] = useState<TourReportGroup | null>(null);
  const latest = useLatestRequest();

  const load = useCallback(async (mode: 'first' | 'refresh' | 'quiet' = 'first') => {
    const isCurrent = latest.start();
    if (mode === 'first') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    try {
      const data = await api.getTourReports();
      if (!isCurrent()) return;
      setGroups(data.tours); setError(false);
    } catch {
      if (isCurrent() && mode !== 'quiet') setError(true);
    } finally {
      if (isCurrent()) { setLoading(false); setRefreshing(false); }
    }
  }, [latest]);
  // 상세에서 처리하고 돌아오면 다시 불러옴
  useFocusEffect(useCallback(() => { void load(groups.length ? 'quiet' : 'first'); }, [load]));

  const done = (item: TourReportGroup) => setGroups(prev => prev.filter(g => g.tourId !== item.tourId)); // 처리한 카드는 목록에서 빠짐
  const dismiss = async (item: TourReportGroup) => {
    if (busy !== null) return;
    setBusy(item.tourId);
    if (await confirmDismissReports(item.tourId, item.title)) done(item);
    setBusy(null);
  };
  const takeDown = async (note: string) => {
    if (!takingDown) return;
    if (await sendTakeDown(takingDown.tourId, note)) { done(takingDown); setTakingDown(null); }
  };

  const renderItem = ({ item }: { item: TourReportGroup }) => {
    const reasons = item.reasons.map(r => `${r.name} ${r.count}`).join('  ·  ');
    const instructor = item.instructor.name ? `${item.instructor.nickname} (${item.instructor.name})` : item.instructor.nickname;
    const memo = item.memo ? `“${item.memo}”${item.moreMemos ? ` 외 ${item.moreMemos}건` : ''}` : null;
    return (
      <View style={styles.card}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${item.title} 상세 보기`} onPress={() => router.push({ pathname: '/tour-detail', params: { id: String(item.tourId), inSheet } })} style={({ pressed }) => pressed && { opacity: 0.8 }}>
          <View style={styles.imageWrap}>
            {item.imageUrl
              ? <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="cover" />
              : <View style={[styles.image, styles.noImage]}><Ionicons name="airplane-outline" size={22} color="rgba(255,255,255,0.3)" /></View>}
            <View style={styles.badge}><Text style={styles.badgeText}>신고 {item.count}건</Text></View>
          </View>
          <View style={styles.body}>
            <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.reasons} numberOfLines={2}>{reasons}</Text>
            {memo && <Text style={styles.meta} numberOfLines={2}>{memo}</Text>}
            <Text style={styles.meta} numberOfLines={1}>강사: {instructor} · {item.count > 1 ? '최근 ' : ''}{formatRequestedAt(item.latestAt)}</Text>
          </View>
        </Pressable>
        <View style={styles.buttons}>
          <Pressable accessibilityRole="button" accessibilityLabel={`${item.title} 문제 없음`} disabled={busy !== null} onPress={() => dismiss(item)} style={({ pressed }) => [styles.reject, pressed && { opacity: 0.7 }]}>
            <Text style={styles.dismissText}>문제 없음</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`${item.title} 내리고 보완 요청`} disabled={busy !== null} onPress={() => setTakingDown(item)} style={({ pressed }) => [styles.takeDown, pressed && { opacity: 0.8 }]}>
            <Text style={styles.takeDownText}>내리고 보완 요청</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: sheetTop }]}>
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
        <Text style={styles.headerTitle}>투어 신고 처리</Text>
        <View style={styles.backButton} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="rgba(255,255,255,0.5)" /></View>
      ) : error ? (
        <Pressable style={styles.center} onPress={() => load()} accessibilityRole="button">
          <Text style={styles.errorText}>신고를 불러오지 못했습니다.{'\n'}눌러서 다시 시도해주세요.</Text>
        </Pressable>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={item => String(item.tourId)}
          renderItem={renderItem}
          ListHeaderComponent={groups.length ? <Text style={styles.summary}>대기 {groups.length}건 · 신고 많은 순</Text> : undefined}
          ListEmptyComponent={<TourEmpty message="처리할 신고가 없어요." />}
          ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
          contentContainerStyle={[styles.list, !groups.length && styles.listEmpty, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} tintColor="rgba(255,255,255,0.6)" />}
        />
      )}
      <ReviewNotePopup
        visible={!!takingDown}
        title="내리고 보완 요청"
        subtitle={`'${takingDown?.title ?? ''}'을(를) 비공개로 내려요.\n강사에게 보완할 점을 적어 주세요.`}
        confirm="내리기"
        initial={takingDown ? `신고 내용: ${takingDown.reasons.map(r => r.name).join(', ')}` : ''}
        onClose={() => setTakingDown(null)}
        onSubmit={takeDown}
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  errorText: { fontFamily: 'SUIT-Regular', fontSize: 15, color: 'rgba(255,255,255,0.35)', textAlign: 'center' },
  list: { paddingHorizontal: SIDE },
  listEmpty: { flexGrow: 1 },
  summary: { fontFamily: 'SUIT-Regular', fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 4, marginBottom: 12 },
  card: { borderRadius: 14, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.1)' },
  imageWrap: { height: 120 },
  image: { width: '100%', height: 120 },
  noImage: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  badge: { position: 'absolute', top: 10, right: 10, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10, backgroundColor: '#FF6B4A' },
  badgeText: { fontFamily: 'SUIT-Bold', fontSize: 11, color: '#FFFFFF' },
  reasons: { fontFamily: 'SUIT-SemiBold', fontSize: 13, color: '#FF9C8A' },
  body: { paddingHorizontal: 16, paddingTop: 12, gap: 4 },
  title: { fontFamily: 'SUIT-Bold', fontSize: 17, color: Colors.brand.white },
  meta: { fontFamily: 'SUIT-Regular', fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  buttons: { flexDirection: 'row', gap: 8, padding: 16, paddingTop: 12 },
  reject: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.22)' },
  dismissText: { fontFamily: 'SUIT-Bold', fontSize: 15, color: Colors.brand.white },
  takeDown: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FF6B4A' },
  takeDownText: { fontFamily: 'SUIT-Bold', fontSize: 15, color: '#FFFFFF' },
});
