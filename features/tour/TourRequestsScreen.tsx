import React, { useCallback, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/Colors';
import { CenterMessage } from '@/features/community/ui';
import { useScreenParams } from '@/features/split/SplitPane';
import { useLatestRequest } from '@/hooks/useLatestRequest';
import { api, type TourRequestItem } from '@/services/api';
import { TourHeader } from './FormParts';
import { Badge, CardButton, TourPhotoCard } from './TourCards';
import { TourGridStatic } from './TourGridList';
import ReviewNotePopup from './ReviewNotePopup';
import { changedLabels } from './edit';
import { confirmApprove, formatRequestedAt, sendRevision } from './requests';
import { useSheetTop } from './useSheetTop';
import { TOUR_STATUS, formatFee, formatTourPeriod } from './ui';
import { useTourRouter } from './nav';

const SIDE = 20;
// 17장 배지: 새 등록은 '승인 대기', 공개 후 수정은 '수정 요청'
const REQUEST_TYPE: Record<TourRequestItem['type'], { label: string; color: string; text: string }> = {
  CREATE: TOUR_STATUS.PENDING,
  UPDATE: { label: '수정 요청', color: '#00B4D8', text: '#FFFFFF' },
};

// 17장 투어 등록요청 (admin): 요청 오래된 순, 한 줄에 2개 (펼친 화면 4개). 카드에서 바로 승인 · 보완 요청, 누르면 투어 상세
export default function TourRequestsScreen() {
  const router = useTourRouter();
  const insets = useSafeAreaInsets();
  const { top, inSheet } = useSheetTop();
  const [requests, setRequests] = useState<TourRequestItem[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [revising, setRevising] = useState<TourRequestItem | null>(null);
  const [width, setWidth] = useState(0);
  const latest = useLatestRequest();
  // 22장: 알림을 눌러 왔는데 그 건이 이미 처리됐으면 알려 줌 (한 번만)
  const { focusTourId } = useScreenParams<{ focusTourId?: string }>();
  const focusChecked = useRef(false);
  const loaded = useRef(false);

  const load = useCallback(async (mode: 'first' | 'refresh' | 'quiet' = 'first') => {
    const isCurrent = latest.start();
    if (mode === 'first') setState('loading');
    if (mode === 'refresh') setRefreshing(true);
    try {
      const data = await api.getTourRequests();
      if (!isCurrent()) return;
      if (focusTourId && !focusChecked.current) {
        focusChecked.current = true;
        if (!data.requests.some(r => r.tour.id === Number(focusTourId))) Alert.alert('알림', '이미 처리된 요청이에요.');
      }
      setRequests(data.requests); setState('ready'); loaded.current = true;
    } catch {
      if (isCurrent() && mode !== 'quiet') setState(prev => (mode === 'refresh' && prev === 'ready' ? prev : 'error'));
    } finally {
      if (isCurrent()) setRefreshing(false);
    }
  }, [latest, focusTourId]);
  // 상세에서 처리하고 돌아오면 다시 불러옴
  useFocusEffect(useCallback(() => { void load(loaded.current ? 'quiet' : 'first'); }, [load]));

  const done = (item: TourRequestItem) => setRequests(prev => prev.filter(r => r.id !== item.id)); // 처리한 카드는 빠짐
  const approve = async (item: TourRequestItem) => {
    if (busy !== null) return;
    setBusy(item.id);
    if (await confirmApprove(item.id, item.tour.name, item.type)) done(item);
    setBusy(null);
  };
  const revise = async (note: string) => {
    if (!revising) return;
    if (await sendRevision(revising.id, note)) { done(revising); setRevising(null); }
  };

  return (
    <View style={[styles.screen, { paddingTop: top }]} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      <TourHeader title="투어 등록요청" onBack={() => router.back()} />
      {state !== 'ready' ? <CenterMessage loading={state === 'loading'} message="등록요청을 불러오지 못했어요." onRetry={() => void load()} /> : (
        <TourGridStatic items={requests} keyOf={item => item.id} width={width} side={SIDE} bottom={insets.bottom}
          empty="처리할 등록요청이 없어요." refreshing={refreshing} onRefresh={() => void load('refresh')}
          header={requests.length ? <Text style={styles.summary}>대기 {requests.length}건 · 요청 오래된 순</Text> : undefined}
          renderCard={(item, cardWidth) => {
            const t = item.tour;
            // 수정 요청은 바뀐 항목을, 새 등록은 나라 · 기간과 참가비를
            const meta = item.type === 'UPDATE' ? `바뀐 항목: ${changedLabels(item.changedFields)}` : `${t.countryName} · ${formatTourPeriod(t.startDate, t.endDate)}`;
            return (
              <TourPhotoCard tour={t} width={cardWidth} stretch badge={<Badge {...REQUEST_TYPE[item.type]} small />}
                lines={{ meta, lead: t.fee !== null ? formatFee(t.fee) : '', count: null, note: { text: `요청: ${item.registrant.nickname} · ${formatRequestedAt(item.requestedAt)}`, color: 'rgba(255,255,255,0.55)' } }}
                onPress={() => router.push({ pathname: '/tour-detail', params: { id: String(t.id), inSheet } })}
                footer={(
                  <View style={styles.buttons}>
                    <View style={styles.button}><CardButton label="보완 요청" kind="danger" disabled={busy !== null} onPress={() => setRevising(item)} /></View>
                    <View style={styles.button}><CardButton label="승인" disabled={busy !== null} onPress={() => void approve(item)} /></View>
                  </View>
                )} />
            );
          }} />
      )}
      <ReviewNotePopup visible={!!revising} title="보완 요청"
        subtitle={`'${revising?.tour.name ?? ''}'에서 보완할 점을 적어 주세요.\n등록자의 내 투어 카드에 그대로 보여요.`}
        onClose={() => setRevising(null)} onSubmit={revise} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.brand.primary },
  summary: { fontFamily: 'SUIT-Regular', fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 2 },
  buttons: { flexDirection: 'row', gap: 6 },
  button: { flex: 1 },
});
