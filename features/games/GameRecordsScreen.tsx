import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Colors from '@/constants/Colors';
import { api, type GameRecord } from '@/services/api';
import Spinner from '@/components/Spinner';
import GlassCircle from '@/components/GlassCircle';
import StripBackSlot from '@/components/StripBackSlot';
import { useWindowedList, type Cursor } from '@/features/community/useWindowedList';
import { GAME_NAMES } from './games';

// 내 게임 기록: 판마다 언제 했는지(날짜 · 시각), 총점, 세부 점수(항목별 값 · 점수). 최근순 10개씩 (서버 game-records.service.ts)
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const pad = (n: number) => String(n).padStart(2, '0');

// '2026.11.12 (목) 14:05' (기기 시간대)
export function playedLabel(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} (${WEEKDAYS[d.getDay()]}) ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const diveTime = (t: number) => `${Math.floor(t / 60)}:${pad(Math.floor(t % 60))}`;

export default function GameRecordsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { game: param } = useLocalSearchParams<{ game?: string }>();
  const game = param && GAME_NAMES[param] ? param : 'freediving';
  const [summary, setSummary] = useState<{ total: number; best: number | null } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const list = useWindowedList<GameRecord>(async (cursor: Cursor) => {
    try {
      const res = await api.getGameRecords(game, cursor);
      setLoadError(null);
      setSummary({ total: res.total, best: res.best });
      return { items: res.records, hasMore: res.hasMore };
    } catch (e: any) {
      setLoadError(e?.message ?? null);
      throw e;
    }
  });
  const { reload } = list;
  useEffect(() => { void reload('first'); }, [reload]);

  const spinner = <View style={styles.more}><Spinner /></View>;
  const intro = (
    <View style={styles.intro}>
      <View style={styles.summary}>
        <View style={styles.summaryCell}>
          <Text style={styles.summaryLabel}>최고 점수</Text>
          <Text style={styles.summaryValue}>{summary?.best ?? '-'}<Text style={styles.summaryUnit}>{summary?.best != null ? '점' : ''}</Text></Text>
        </View>
        <View style={styles.summaryCell}>
          <Text style={styles.summaryLabel}>플레이</Text>
          <Text style={styles.summaryValue}>{summary?.total ?? 0}<Text style={styles.summaryUnit}>판</Text></Text>
        </View>
      </View>
      {game === 'freediving' ? <Text style={styles.legend}>점수 = 수심 40 + 폐 공기 사용 20 + 이퀄 횟수 15 + 두 번째 선 유지 25</Text> : null}
      {list.more === 'newer' ? spinner : null}
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* 게임 화면은 상태 표시줄을 숨겨서, 이 화면에선 다시 보이게 */}
      <StatusBar style="light" hidden={false} />
      <View style={styles.header}>
        <StripBackSlot size={36}>
          <Pressable accessibilityLabel="뒤로가기" onPress={() => router.back()} style={({ pressed }) => [styles.headerSide, pressed && { opacity: 0.6 }]}>
            <GlassCircle fallbackStyle={styles.backCircle}>
              <Text style={styles.backArrow}>{'<'}</Text>
            </GlassCircle>
          </Pressable>
        </StripBackSlot>
        <Text style={styles.headerTitle} numberOfLines={1}>{GAME_NAMES[game]} 기록</Text>
        <View style={styles.headerSide} />
      </View>

      {list.state === 'error' ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>{loadError || '기록을 불러오지 못했어요.'}</Text>
          <Pressable onPress={() => void reload('first')} style={({ pressed }) => [styles.retry, pressed && { opacity: 0.6 }]}>
            <Text style={styles.retryText}>다시 시도</Text>
          </Pressable>
        </View>
      ) : list.state === 'loading' ? (
        <View style={styles.center}><Spinner /></View>
      ) : (
        <FlatList
          data={list.items}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => <RecordCard record={item} />}
          ListHeaderComponent={intro}
          ListEmptyComponent={<Text style={styles.emptyList}>아직 기록이 없어요.{'\n'}한 판 하면 여기에 남아요.</Text>}
          ListFooterComponent={list.more === 'older' ? spinner : undefined}
          refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={() => void reload('refresh')} tintColor="rgba(255,255,255,0.6)" />}
          onEndReached={() => void list.loadOlder()}
          onEndReachedThreshold={0.5}
          onStartReached={() => void list.loadNewer()}
          onStartReachedThreshold={0.5}
          maintainVisibleContentPosition={{ minIndexForVisible: 0, autoscrollToTopThreshold: 40 }}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 16 }]}
        />
      )}
    </View>
  );
}

// 한 판: 날짜 · 시각, 총점, 세부 점수 4칸 (값 + 받은 점수/만점)
function RecordCard({ record }: { record: GameRecord }) {
  const d = record.details;
  const wasted = !!d?.wasted;
  const blackout = !!d?.blackout; // 2026-11-12부터 (예전 기록엔 없음)
  const failed = wasted || blackout;
  const cells = d?.points ? [
    { label: '최대 수심', value: `${d.maxDepth.toFixed(1)}m`, pts: d.points.depth, max: 40 },
    { label: '공기 사용', value: `${Math.round((1 - d.air) * 100)}%`, pts: d.points.air, max: 20 },
    { label: '이퀄', value: `${d.eqCount}회`, pts: d.points.eq, max: 15 },
    { label: '선 유지', value: `${Math.round(d.zoneRate * 100)}%`, pts: d.points.zone, max: 25 },
  ] : [];
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardTopText}>
          <Text style={styles.when}>{playedLabel(record.playedAt)}</Text>
          {d?.points ? (
            <Text style={[styles.meta, failed && { color: '#FFB4AC' }]} numberOfLines={1}>
              {wasted
                ? `${d.maxDepth.toFixed(1)}m에서 고막이 버티지 못했어요`
                : blackout
                  ? `${d.maxDepth.toFixed(1)}m까지 내려갔다가 블랙아웃됐어요`
                  : `다이빙 ${diveTime(d.diveTime)} · 알맞은 이퀄 ${d.idealEq}회`}
            </Text>
          ) : null}
        </View>
        {wasted ? <View style={styles.wastedTag}><Text style={styles.wastedTagText}>WASTED</Text></View> : null}
        {blackout ? <View style={styles.blackoutTag}><Text style={styles.wastedTagText}>BLACKOUT</Text></View> : null}
        <Text style={[styles.score, failed && { color: '#FF5A4E' }]}>{record.score}<Text style={styles.scoreUnit}>점</Text></Text>
      </View>
      {cells.length ? (
        <View style={styles.cells}>
          {cells.map(c => (
            <View key={c.label} style={styles.cell}>
              <Text style={styles.cellLabel} numberOfLines={1}>{c.label}</Text>
              <Text style={styles.cellValue} numberOfLines={1}>{c.value}</Text>
              <Text style={styles.cellPts}>{Math.round(c.pts)}<Text style={styles.cellMax}>/{c.max}</Text></Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.brand.primary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 52, paddingHorizontal: 20 },
  headerSide: { width: 36, height: 36 },
  backCircle: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  backArrow: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.white, marginRight: 1 },
  headerTitle: { flex: 1, textAlign: 'center', marginHorizontal: 8, fontFamily: 'SUIT-Bold', fontSize: 18, color: Colors.brand.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 14 },
  emptyText: { fontFamily: 'SUIT-Regular', fontSize: 15, lineHeight: 22, color: 'rgba(255,255,255,0.55)', textAlign: 'center' },
  retry: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)' },
  retryText: { fontFamily: 'SUIT-SemiBold', fontSize: 14, color: Colors.brand.white },
  listContent: { paddingHorizontal: 20 },
  intro: { paddingTop: 8, paddingBottom: 4, gap: 10 },
  summary: { flexDirection: 'row', gap: 10 },
  summaryCell: { flex: 1, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: 'rgba(255,255,255,0.08)', gap: 2 },
  summaryLabel: { fontFamily: 'SUIT-SemiBold', fontSize: 12, color: 'rgba(255,255,255,0.55)' },
  summaryValue: { fontFamily: 'SUIT-Bold', fontSize: 24, color: Colors.brand.white },
  summaryUnit: { fontFamily: 'SUIT-SemiBold', fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  legend: { fontFamily: 'SUIT-Regular', fontSize: 12, lineHeight: 18, color: 'rgba(255,255,255,0.5)' },
  more: { paddingVertical: 14, alignItems: 'center' },
  emptyList: { fontFamily: 'SUIT-Regular', fontSize: 14, lineHeight: 21, color: 'rgba(255,255,255,0.4)', textAlign: 'center', paddingTop: 36 },
  card: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 14, marginTop: 10, gap: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTopText: { flex: 1, minWidth: 0, gap: 3 },
  when: { fontFamily: 'SUIT-SemiBold', fontSize: 14, color: Colors.brand.white },
  meta: { fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  wastedTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: 'rgba(224,38,59,0.85)' },
  wastedTagText: { fontFamily: 'SUIT-Bold', fontSize: 10, color: '#FFFFFF', letterSpacing: 0.5 },
  blackoutTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.8)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  score: { fontFamily: 'SUIT-Bold', fontSize: 26, color: '#00E5FF' },
  scoreUnit: { fontFamily: 'SUIT-SemiBold', fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  cells: { flexDirection: 'row', gap: 6 },
  cell: { flex: 1, minWidth: 0, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 8, backgroundColor: 'rgba(0,0,0,0.15)', gap: 2 },
  cellLabel: { fontFamily: 'SUIT-Regular', fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  cellValue: { fontFamily: 'SUIT-SemiBold', fontSize: 14, color: Colors.brand.white },
  cellPts: { fontFamily: 'SUIT-Bold', fontSize: 13, color: '#00E5FF' },
  cellMax: { fontFamily: 'SUIT-Regular', fontSize: 11, color: 'rgba(255,255,255,0.45)' },
});
