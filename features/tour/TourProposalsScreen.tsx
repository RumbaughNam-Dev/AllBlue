import React, { useCallback, useState } from 'react';
import { Alert, DeviceEventEmitter, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/Colors';
import { CenterMessage } from '@/features/community/ui';
import { api, type TourProposalItem, type TourSummary } from '@/services/api';
import { TourHeader } from './FormParts';
import { Avatar, Badge, CardButton, TourEmpty, TourGrid, TourPhoto, useGridWidth } from './TourCards';
import { CYAN, PROPOSAL_STATUS, formatFee, formatTourPeriod } from './ui';
import { TOURS_CHANGED, useTourRouter } from './nav';

const SIDE = 20;

// 9장 받은 제안 (등록자만): 받은 순, 큰 사진 카드 한 줄 2개 (펼친 화면 4개). 카드를 누르면 자세히 보기, '이 제안 승낙'
export default function TourProposalsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useTourRouter();
  const insets = useSafeAreaInsets();
  const grid = useGridWidth();
  const [tour, setTour] = useState<TourSummary | null>(null);
  const [items, setItems] = useState<TourProposalItem[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (mode: 'first' | 'refresh' | 'quiet' = 'first') => {
    if (mode === 'first') setState('loading');
    if (mode === 'refresh') setRefreshing(true);
    try {
      const result = await api.getTourProposals(Number(id));
      setTour(result.tour); setItems(result.items); setState('ready');
    } catch {
      setState(prev => (mode !== 'first' && prev === 'ready' ? prev : 'error'));
    } finally {
      setRefreshing(false);
    }
  }, [id]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const accept = (item: TourProposalItem) => {
    if (busy) return;
    const others = items.length - 1;
    Alert.alert(`${item.instructor.nickname}님의 제안을 승낙할까요?`,
      `승낙하면 투어가 '모집 마감'되고 이 제안이 투어 정보가 돼요.${others > 0 ? ` 다른 제안 ${others}개는 자동으로 마감되고` : ''} 참여자 모두에게 알림이 가요.`,
      [{ text: '취소', style: 'cancel' }, {
        text: '승낙', onPress: async () => {
          setBusy(true);
          try {
            await api.acceptTourProposal(item.id);
            DeviceEventEmitter.emit(TOURS_CHANGED);
            Alert.alert('모집이 마감됐어요', `${item.instructor.nickname}님이 인솔 강사가 됐어요.`, [{ text: '확인', onPress: () => router.back() }]);
          } catch (e: any) {
            if (!e?._handled) Alert.alert('알림', e?.message ?? '승낙하지 못했어요. 잠시 후 다시 시도해 주세요.');
            void load('quiet');
          } finally {
            setBusy(false);
          }
        },
      }]);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <TourHeader title="받은 제안" onBack={() => router.back()} />
      {state !== 'ready' || !tour ? <CenterMessage loading={state === 'loading'} message="제안을 불러오지 못했어요." onRetry={() => void load()} /> : (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load('refresh')} tintColor="rgba(255,255,255,0.6)" />}>
          <View style={styles.summary}>
            <Text style={styles.summaryTitle}>{tour.name}</Text>
            <Text style={styles.summaryMeta}>{formatTourPeriod(tour.startDate, tour.endDate)} · {tour.count}명 · {tour.status === 'SEEKING_LEADER' ? '인솔자 모집중' : '참여자를 다시 모으는 중'}</Text>
          </View>
          <Text style={styles.count}>받은 제안 {items.length}개 · 받은 순</Text>
          {tour.status !== 'SEEKING_LEADER' && items.length ? (
            <Text style={styles.held}>참여자가 빠져 지금은 승낙할 수 없어요. 인원이 다시 다 모이면 이어서 승낙할 수 있어요.</Text>
          ) : null}
          <View onLayout={grid.onLayout}>
            {items.length ? (
              <TourGrid items={items} cardWidth={grid.cardWidth} keyOf={item => item.id} renderItem={item => (
                <Pressable onPress={() => router.push({ pathname: '/tour-proposal', params: { id: String(item.id) } })}
                  style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}>
                  <TourPhoto uri={item.coverUrl} style={{ width: grid.cardWidth, height: grid.cardWidth }}>
                    {item.status === 'HELD' ? <View style={styles.badge}><Badge {...PROPOSAL_STATUS.HELD} small /></View> : null}
                  </TourPhoto>
                  <View style={styles.body}>
                    <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.fee}>{formatFee(item.fee)}</Text>
                    <View style={styles.who}>
                      <Avatar uri={item.instructor.profileImage} nickname={item.instructor.nickname} size={18} />
                      <Text style={styles.whoText} numberOfLines={1}>{item.instructor.nickname} · {item.instructor.licenses[0] ?? '강사'}</Text>
                    </View>
                    {item.message ? <Text style={styles.message} numberOfLines={1}>{item.message}</Text> : null}
                    <View style={styles.footer}>
                      <CardButton label="이 제안 승낙" disabled={busy || item.status !== 'WAITING' || tour.status !== 'SEEKING_LEADER'} onPress={() => accept(item)} />
                    </View>
                  </View>
                </Pressable>
              )} />
            ) : <TourEmpty message="아직 받은 제안이 없어요." />}
          </View>
          <Text style={styles.guide}>카드를 누르면 자세히 볼 수 있어요. 마음에 드는 제안이 올 때까지 기다려도 돼요. 출발일이 지나면 만료돼요.</Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.brand.primary },
  scroll: { paddingHorizontal: SIDE, gap: 12 },
  summary: { padding: 14, borderRadius: 12, backgroundColor: 'rgba(2,62,115,0.9)', gap: 4 },
  summaryTitle: { fontFamily: 'SUIT-Bold', fontSize: 15, color: Colors.brand.white },
  summaryMeta: { fontFamily: 'SUIT-Regular', fontSize: 12, color: '#B8D4F0' },
  count: { fontFamily: 'SUIT-Regular', fontSize: 13, color: '#B8D4F0' },
  held: { fontFamily: 'SUIT-SemiBold', fontSize: 13, lineHeight: 19, color: '#FFB4A2' },
  card: { borderRadius: 14, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.1)' },
  badge: { position: 'absolute', top: 8, left: 8 },
  body: { paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10, gap: 4 },
  title: { fontFamily: 'SUIT-Bold', fontSize: 14, color: Colors.brand.white },
  fee: { fontFamily: 'SUIT-Bold', fontSize: 13, color: CYAN },
  who: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  whoText: { flex: 1, fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  message: { fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  footer: { marginTop: 4 },
  guide: { fontFamily: 'SUIT-Regular', fontSize: 12, lineHeight: 18, color: 'rgba(255,255,255,0.45)' },
});
