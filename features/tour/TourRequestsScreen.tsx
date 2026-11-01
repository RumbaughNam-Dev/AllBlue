import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator, RefreshControl, Image, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { api, TourRequestItem } from '@/services/api';
import GlassCircle from '@/components/GlassCircle';
import StripBackSlot from '@/components/StripBackSlot';
import { useAppRouter, useIsPaneRoot, useScreenParams } from '@/features/split/SplitPane';
import { useLatestRequest } from '@/hooks/useLatestRequest';
import { useSheetTop } from './useSheetTop';
import { TourEmpty } from './TourCards';
import { confirmApprove, formatRequestedAt, sendRevision } from './requests';
import ReviewNotePopup from './ReviewNotePopup';
import { formatFee, formatTourPeriod } from './ui';

const SIDE = 20;
// Mirrors common_code TOUR_REQUEST_TYPE (label, badge color)
const REQUEST_TYPE: Record<TourRequestItem['type'], { label: string; color: string; text: string }> = {
  CREATE: { label: '승인 대기', color: '#B794F4', text: '#1E0F3D' },
  UPDATE: { label: '수정 요청', color: '#00B4D8', text: '#032A36' },
};

// 15장 투어 등록요청 (admin): 대기 중인 요청을 오래된 순으로, 카드에서 바로 승인 · 불허, 누르면 투어 상세
export default function TourRequestsScreen() {
  const router = useAppRouter();
  const isPaneRoot = useIsPaneRoot();
  const insets = useSafeAreaInsets();
  const { top: sheetTop, inSheet } = useSheetTop();
  const [requests, setRequests] = useState<TourRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [revising, setRevising] = useState<TourRequestItem | null>(null);
  const latest = useLatestRequest();
  // 21장: 알림을 눌러 왔는데 그 건이 이미 처리됐으면 알려 줌 (한 번만)
  const { focusTourId } = useScreenParams<{ focusTourId?: string }>();
  const focusChecked = useRef(false);

  const load = useCallback(async (mode: 'first' | 'refresh' | 'quiet' = 'first') => {
    const isCurrent = latest.start();
    if (mode === 'first') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    try {
      const data = await api.getTourRequests();
      if (!isCurrent()) return;
      if (focusTourId && !focusChecked.current) {
        focusChecked.current = true;
        if (!data.requests.some(r => r.tour.id === Number(focusTourId))) Alert.alert('알림', '이미 처리된 요청이에요.');
      }
      setRequests(data.requests); setError(false);
    } catch {
      if (isCurrent() && mode !== 'quiet') setError(true);
    } finally {
      if (isCurrent()) { setLoading(false); setRefreshing(false); }
    }
  }, [latest]);
  // 상세에서 처리하고 돌아오면 다시 불러옴
  useFocusEffect(useCallback(() => { void load(requests.length ? 'quiet' : 'first'); }, [load]));

  const done = (item: TourRequestItem) => setRequests(prev => prev.filter(r => r.id !== item.id)); // 처리한 카드는 목록에서 빠짐
  const approve = async (item: TourRequestItem) => {
    if (busy !== null) return;
    setBusy(item.id);
    if (await confirmApprove(item.id, item.tour.title)) done(item);
    setBusy(null);
  };
  const revise = async (note: string) => {
    if (!revising) return;
    if (await sendRevision(revising.id, note)) { done(revising); setRevising(null); }
  };

  const renderItem = ({ item }: { item: TourRequestItem }) => {
    const type = REQUEST_TYPE[item.type] ?? REQUEST_TYPE.CREATE;
    const meta = [item.tour.countryName, formatTourPeriod(item.tour.startDate, item.tour.endDate), item.tour.fee !== null ? `참가비 ${formatFee(item.tour.fee)}` : null]
      .filter(Boolean).join(' · ');
    const requester = item.instructor.name ? `${item.instructor.nickname} (${item.instructor.name})` : item.instructor.nickname;
    return (
      <View style={styles.card}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${item.tour.title} 상세 보기`} onPress={() => router.push({ pathname: '/tour-detail', params: { id: String(item.tour.id), inSheet } })} style={({ pressed }) => pressed && { opacity: 0.8 }}>
          <View style={styles.imageWrap}>
            {item.tour.imageUrl
              ? <Image source={{ uri: item.tour.imageUrl }} style={styles.image} resizeMode="cover" />
              : <View style={[styles.image, styles.noImage]}><Ionicons name="airplane-outline" size={22} color="rgba(255,255,255,0.3)" /></View>}
            <View style={[styles.badge, { backgroundColor: type.color }]}><Text style={[styles.badgeText, { color: type.text }]}>{type.label}</Text></View>
          </View>
          <View style={styles.body}>
            <Text style={styles.title} numberOfLines={1}>{item.tour.title}</Text>
            <Text style={styles.meta} numberOfLines={1}>{meta}</Text>
            <Text style={styles.meta} numberOfLines={1}>요청: {requester} · {formatRequestedAt(item.requestedAt)}</Text>
          </View>
        </Pressable>
        <View style={styles.buttons}>
          <Pressable accessibilityRole="button" accessibilityLabel={`${item.tour.title} 보완 요청`} disabled={busy !== null} onPress={() => setRevising(item)} style={({ pressed }) => [styles.reject, pressed && { opacity: 0.7 }]}>
            <Text style={styles.rejectText}>보완 요청</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`${item.tour.title} 승인`} disabled={busy !== null} onPress={() => approve(item)} style={({ pressed }) => [styles.approve, pressed && { opacity: 0.8 }]}>
            <Text style={styles.approveText}>승인</Text>
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
        <Text style={styles.headerTitle}>투어 등록요청</Text>
        <View style={styles.backButton} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="rgba(255,255,255,0.5)" /></View>
      ) : error ? (
        <Pressable style={styles.center} onPress={() => load()} accessibilityRole="button">
          <Text style={styles.errorText}>등록요청을 불러오지 못했습니다.{'\n'}눌러서 다시 시도해주세요.</Text>
        </Pressable>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
          ListHeaderComponent={requests.length ? <Text style={styles.summary}>대기 {requests.length}건 · 요청 오래된 순</Text> : undefined}
          ListEmptyComponent={<TourEmpty message="처리할 등록요청이 없어요." />}
          ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
          contentContainerStyle={[styles.list, !requests.length && styles.listEmpty, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} tintColor="rgba(255,255,255,0.6)" />}
        />
      )}
      <ReviewNotePopup
        visible={!!revising}
        title="보완 요청"
        subtitle={`'${revising?.tour.title ?? ''}'에서 보완할 점을 적어 주세요.\n강사의 투어 관리 카드에 그대로 보여요.`}
        onClose={() => setRevising(null)}
        onSubmit={revise}
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
  badge: { position: 'absolute', top: 10, right: 10, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10 },
  badgeText: { fontFamily: 'SUIT-Bold', fontSize: 11 },
  body: { paddingHorizontal: 16, paddingTop: 12, gap: 4 },
  title: { fontFamily: 'SUIT-Bold', fontSize: 17, color: Colors.brand.white },
  meta: { fontFamily: 'SUIT-Regular', fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  buttons: { flexDirection: 'row', gap: 8, padding: 16, paddingTop: 12 },
  reject: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.22)' },
  rejectText: { fontFamily: 'SUIT-Bold', fontSize: 15, color: '#FF8A7A' },
  approve: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#00B4D8' },
  approveText: { fontFamily: 'SUIT-Bold', fontSize: 15, color: '#032A36' },
});
