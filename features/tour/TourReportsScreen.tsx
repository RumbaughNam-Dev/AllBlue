import React, { useCallback, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/Colors';
import { CenterMessage } from '@/features/community/ui';
import { useScreenParams } from '@/features/split/SplitPane';
import { useLatestRequest } from '@/hooks/useLatestRequest';
import { api, type TourReportGroup } from '@/services/api';
import { TourHeader } from './FormParts';
import { Badge, CardButton, TourPhotoCard } from './TourCards';
import { TourGridStatic } from './TourGridList';
import ReviewNotePopup from './ReviewNotePopup';
import { confirmDismissReports, formatRequestedAt, sendTakeDown } from './requests';
import { useSheetTop } from './useSheetTop';
import { useTourRouter } from './nav';

const SIDE = 20;
const REPORT_BADGE = { color: '#FF8A75', text: '#FFFFFF' };

// 20장 투어 신고 처리 (admin): 투어별로 묶어 신고 수 · 사유, 신고 많은 순. 한 줄에 2개 (펼친 화면 4개), 누르면 투어 상세
export default function TourReportsScreen() {
  const router = useTourRouter();
  const insets = useSafeAreaInsets();
  const { top, inSheet } = useSheetTop();
  const [groups, setGroups] = useState<TourReportGroup[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [takingDown, setTakingDown] = useState<TourReportGroup | null>(null);
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
      const data = await api.getTourReports();
      if (!isCurrent()) return;
      if (focusTourId && !focusChecked.current) {
        focusChecked.current = true;
        if (!data.tours.some(g => g.tour.id === Number(focusTourId))) Alert.alert('알림', '이미 처리된 신고예요.');
      }
      setGroups(data.tours); setState('ready'); loaded.current = true;
    } catch {
      if (isCurrent() && mode !== 'quiet') setState(prev => (mode === 'refresh' && prev === 'ready' ? prev : 'error'));
    } finally {
      if (isCurrent()) setRefreshing(false);
    }
  }, [latest, focusTourId]);
  // 상세에서 보고 돌아오면 다시 불러옴
  useFocusEffect(useCallback(() => { void load(loaded.current ? 'quiet' : 'first'); }, [load]));

  const done = (item: TourReportGroup) => setGroups(prev => prev.filter(g => g.tour.id !== item.tour.id)); // 처리한 카드는 빠짐
  const dismiss = async (item: TourReportGroup) => {
    if (busy !== null) return;
    setBusy(item.tour.id);
    if (await confirmDismissReports(item.tour.id, item.tour.name)) done(item);
    setBusy(null);
  };
  const takeDown = async (note: string) => {
    if (!takingDown) return;
    if (await sendTakeDown(takingDown.tour.id, note)) { done(takingDown); setTakingDown(null); }
  };

  return (
    <View style={[styles.screen, { paddingTop: top }]} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      <TourHeader title="투어 신고 처리" onBack={() => router.back()} />
      {state !== 'ready' ? <CenterMessage loading={state === 'loading'} message="신고를 불러오지 못했어요." onRetry={() => void load()} /> : (
        <TourGridStatic items={groups} keyOf={item => item.tour.id} width={width} side={SIDE} bottom={insets.bottom}
          empty="처리할 신고가 없어요." refreshing={refreshing} onRefresh={() => void load('refresh')}
          header={groups.length ? <Text style={styles.summary}>대기 {groups.length}건 · 신고 많은 순</Text> : undefined}
          renderCard={(item, cardWidth) => (
            <TourPhotoCard tour={item.tour} width={cardWidth} stretch badge={<Badge label={`신고 ${item.count}건`} {...REPORT_BADGE} small />}
              lines={{
                meta: item.reasons.map(r => `${r.name} ${r.count}`).join(' · '), lead: '', count: null,
                note: { text: `등록: ${item.tour.registrant.nickname} · ${formatRequestedAt(item.latestAt)}`, color: 'rgba(255,255,255,0.55)' },
              }}
              onPress={() => router.push({ pathname: '/tour-detail', params: { id: String(item.tour.id), inSheet } })}
              footer={(
                <>
                  {item.memo ? <Text style={styles.memo} numberOfLines={2}>“{item.memo}”{item.moreMemos ? ` 외 ${item.moreMemos}건` : ''}</Text> : null}
                  <CardButton label="내리고 보완 요청" kind="salmon" disabled={busy !== null} onPress={() => setTakingDown(item)} />
                  <CardButton label="문제 없음" kind="dark" disabled={busy !== null} onPress={() => void dismiss(item)} />
                </>
              )} />
          )} />
      )}
      <ReviewNotePopup visible={!!takingDown} title="내리고 보완 요청"
        subtitle={`'${takingDown?.tour.name ?? ''}'을(를) 비공개하고 등록자에게 보완할 점을 보내요.\n등록자의 내 투어 카드에 그대로 보여요.`}
        onClose={() => setTakingDown(null)} onSubmit={takeDown} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.brand.primary },
  summary: { fontFamily: 'SUIT-Regular', fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 2 },
  memo: { fontFamily: 'SUIT-Regular', fontSize: 12, lineHeight: 17, color: 'rgba(255,255,255,0.75)' },
});
