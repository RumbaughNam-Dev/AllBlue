import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, DeviceEventEmitter, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/Colors';
import { CenterMessage } from '@/features/community/ui';
import { useAuth } from '@/contexts/AuthContext';
import { api, type TourApplicationItem, type TourSummary } from '@/services/api';
import { TourHeader } from './FormParts';
import { Avatar, CardButton } from './TourCards';
import { formatTourPeriod } from './ui';
import { formatRequestedAt } from './requests';
import { profileHref, TOURS_CHANGED, useTourRouter } from './nav';

const SIDE = 20;

// 7장 참여 신청 관리 (등록자): 신청 순, 한 줄에 하나 (한마디를 읽고 수락 · 거절). 프로필 사진을 크게, 누르면 프로필
export default function TourApplicationsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useTourRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [tour, setTour] = useState<TourSummary | null>(null);
  const [items, setItems] = useState<TourApplicationItem[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async (mode: 'first' | 'refresh' | 'quiet' = 'first') => {
    if (mode === 'first') setState('loading');
    if (mode === 'refresh') setRefreshing(true);
    try {
      const result = await api.getTourApplications(Number(id));
      setTour(result.tour); setItems(result.items); setState('ready');
    } catch {
      setState(prev => (mode !== 'first' && prev === 'ready' ? prev : 'error'));
    } finally {
      setRefreshing(false);
    }
  }, [id]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const decide = async (item: TourApplicationItem, decision: 'accept' | 'reject') => {
    if (busy) return;
    setBusy(item.id);
    try {
      const result = await api.decideTourApplication(item.id, decision);
      DeviceEventEmitter.emit(TOURS_CHANGED);
      if (result.tourStatus === 'SEEKING_LEADER') Alert.alert('인원이 다 모였어요', "'인솔자 모집중'으로 바뀌고 강사님들께 인솔 제안 요청이 갔어요.");
      if (result.tourStatus === 'CLOSED') Alert.alert('모집이 마감됐어요', '참여자 모두에게 알렸어요.');
      await load('quiet');
    } catch (e: any) {
      if (!e?._handled) Alert.alert('알림', e?.message ?? '처리하지 못했어요. 잠시 후 다시 시도해 주세요.');
      await load('quiet');
    } finally {
      setBusy(null);
    }
  };

  // 마지막 자리를 수락하면 다음 상태로 바뀌니 확인 창 (7장 오른쪽)
  const accept = (item: TourApplicationItem) => {
    if (!tour) return;
    const last = tour.count + 1 >= tour.capacity;
    if (!last) { void decide(item, 'accept'); return; }
    const others = items.length - 1;
    Alert.alert(`${item.user.nickname}님을 수락할까요?`,
      `수락하면 ${tour.capacity} / ${tour.capacity}명이 돼서 다음 상태로 바뀌어요.${others > 0 ? `\n남은 신청 ${others}건은 자동으로 마감돼요.` : ''}`,
      [{ text: '취소', style: 'cancel' }, { text: '수락', onPress: () => void decide(item, 'accept') }]);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <TourHeader title="참여 신청" onBack={() => router.back()} />
      {state !== 'ready' || !tour ? <CenterMessage loading={state === 'loading'} message="신청을 불러오지 못했어요." onRetry={() => void load()} /> : (
        <FlatList
          data={items}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }, !items.length && { flexGrow: 1 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load('refresh')} tintColor="rgba(255,255,255,0.6)" />}
          ListHeaderComponent={(
            <View style={styles.headerArea}>
              <View style={styles.summary}>
                <Text style={styles.summaryTitle}>{tour.name}</Text>
                <Text style={styles.summaryMeta}>
                  {formatTourPeriod(tour.startDate, tour.endDate)} · {tour.count} / {tour.capacity}명 · {Math.max(0, tour.capacity - tour.count)}자리 남음
                </Text>
              </View>
              <Text style={styles.count}>대기 {items.length}건 · 신청 순</Text>
            </View>
          )}
          ListEmptyComponent={<CenterMessage message="기다리는 신청이 없어요." />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Pressable accessibilityRole="link" accessibilityLabel={`${item.user.nickname} 프로필 보기`} onPress={() => router.push(profileHref(item.user.userId, user?.id))}
                style={({ pressed }) => [styles.who, pressed && { opacity: 0.7 }]}>
                <Avatar uri={item.user.profileImage} nickname={item.user.nickname} size={56} level={item.user.badgeLevel} />
                <View style={styles.whoBody}>
                  <Text style={styles.name} numberOfLines={1}>{item.user.nickname}</Text>
                  <Text style={styles.sub} numberOfLines={1}>{item.user.licenses.join(' · ') || '자격증 없음'}</Text>
                </View>
                <Text style={styles.time}>{formatRequestedAt(item.appliedAt)}</Text>
              </Pressable>
              {item.message ? <Text style={styles.message}>“{item.message}”</Text> : null}
              <View style={styles.buttons}>
                <View style={styles.button}><CardButton label="거절" kind="danger" disabled={busy !== null} onPress={() => void decide(item, 'reject')} /></View>
                <View style={styles.button}><CardButton label="수락" disabled={busy !== null} onPress={() => accept(item)} /></View>
              </View>
              {busy === item.id ? <ActivityIndicator style={styles.spinner} color="#FFFFFF" /> : null}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.brand.primary },
  list: { paddingHorizontal: SIDE, gap: 10 },
  headerArea: { gap: 12, paddingBottom: 2 },
  summary: { padding: 14, borderRadius: 12, backgroundColor: 'rgba(2,62,115,0.9)', gap: 4 },
  summaryTitle: { fontFamily: 'SUIT-Bold', fontSize: 15, color: Colors.brand.white },
  summaryMeta: { fontFamily: 'SUIT-Regular', fontSize: 12, color: '#B8D4F0' },
  count: { fontFamily: 'SUIT-Regular', fontSize: 13, color: '#B8D4F0' },
  card: { padding: 14, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', gap: 10 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  whoBody: { flex: 1, gap: 3 },
  name: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.white },
  sub: { fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  time: { fontFamily: 'SUIT-Regular', fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  message: { fontFamily: 'SUIT-Regular', fontSize: 14, lineHeight: 20, color: Colors.brand.white },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  button: { width: 88 },
  spinner: { position: 'absolute', right: 14, top: 14 },
});
