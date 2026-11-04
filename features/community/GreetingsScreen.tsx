import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, PanResponder, Platform, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { api, type CommunityGreeting } from '@/services/api';
import { GreetingRow } from './Cards';
import { CenterMessage, CommunityHeader, HeaderButton, LIMITS, styles as ui } from './ui';
import { useContentMenu } from './useContentMenu';
import { dayLabel, monthCells, shiftDay, shiftMonth, WEEKDAYS } from './greetingDates';

// 6장 출석인사: 하루 단위로 인사 건수와 한 줄 목록만 (상세 없음). 날짜를 누르면 달력, 오늘만 입력 · 하루 1번 · 삭제만
const EDGE_BACK_WIDTH = 30; // 왼쪽 끝 (뒤로가기 밀기 영역)
const SWIPE_DISTANCE = 50;

export default function GreetingsScreen() {
  const insets = useSafeAreaInsets();
  const [day, setDay] = useState<string | null>(null);
  const [today, setToday] = useState<string | null>(null);
  const [data, setData] = useState<{ count: number; greetedToday: boolean; items: CommunityGreeting[] } | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [calendar, setCalendar] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const request = useRef(0);
  const menu = useContentMenu();

  const load = useCallback(async (target = day) => {
    const id = ++request.current;
    try {
      const result = await api.getGreetings(target ?? undefined);
      if (id !== request.current) return;
      setDay(result.date); setToday(result.today);
      setData({ count: result.count, greetedToday: result.greetedToday, items: result.items });
      setError(false);
    } catch {
      if (id === request.current) setError(true);
    }
  }, [day]);
  useEffect(() => { void load(null); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (target: string) => { setDay(target); setData(null); setCalendar(false); void load(target); };
  const send = async () => {
    const content = text.replace(/\s+/g, ' ').trim();
    if (!content || sending) return;
    setSending(true);
    try {
      await api.greet(content);
      setText('');
      await load(today);
    } catch (e: any) {
      if (e?.code === 'ALREADY') { Alert.alert('오늘은 이미 인사했어요'); void load(today); }
      else if (!e?._handled) Alert.alert('인사를 남기지 못했어요', e?.message ?? '다시 시도해 주세요.');
    } finally {
      setSending(false);
    }
  };
  const openMenu = (g: CommunityGreeting) => menu.open({
    type: 'GREETING', id: g.id, author: g.author, mine: g.mine, canDelete: g.canDelete,
    onDeleted: () => void load(), onBlocked: () => void load(),
  });

  const isToday = !!day && day === today;

  // 화면 가운데에서 좌우로 밀면 전날 · 다음 날 (오른쪽으로 밀면 전날). 왼쪽 끝에서 밀면 화면 닫기(뒤로)는 그대로
  const swipeDay = useRef<(dir: -1 | 1) => void>(() => {});
  swipeDay.current = dir => {
    if (!day || (dir === 1 && isToday)) return;
    go(shiftDay(day, dir));
  };
  const swipe = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.x0 > EDGE_BACK_WIDTH && Math.abs(g.dx) > 15 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderRelease: (_, g) => {
      if (g.dx > SWIPE_DISTANCE) swipeDay.current(-1);
      else if (g.dx < -SWIPE_DISTANCE) swipeDay.current(1);
    },
  })).current;

  return (
    <KeyboardAvoidingView style={[ui.screen, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <CommunityHeader title="출석인사" right={day && <HeaderButton icon={calendar ? 'list' : 'calendar-outline'} label={calendar ? '목록' : '달력'} onPress={() => setCalendar(c => !c)} />} />
      {!day || (!data && !calendar) ? <CenterMessage loading={!error} message="인사를 불러오지 못했어요." onRetry={error ? () => load() : undefined} /> : calendar ? (
        <GreetingCalendar day={day} today={today ?? day} onPick={go} />
      ) : (
        <View style={{ flex: 1 }} {...swipe.panHandlers}>
          <View style={styles.dayBar}>
            <Pressable accessibilityLabel="전날" onPress={() => go(shiftDay(day, -1))} hitSlop={10}><Ionicons name="chevron-back" size={22} color="white" /></Pressable>
            <Pressable onPress={() => setCalendar(true)} style={styles.dayCenter}>
              <Text style={styles.dayText}>{dayLabel(day)}{isToday ? ' · 오늘' : ''}</Text>
              <Text style={styles.count}>인사 {data?.count ?? 0}건</Text>
            </Pressable>
            <Pressable accessibilityLabel="다음 날" disabled={isToday} onPress={() => go(shiftDay(day, 1))} hitSlop={10} style={isToday && { opacity: 0.25 }}>
              <Ionicons name="chevron-forward" size={22} color="white" />
            </Pressable>
          </View>
          <FlatList
            data={data?.items ?? []}
            keyExtractor={g => String(g.id)}
            contentContainerStyle={[styles.list, !data?.items.length && { flexGrow: 1 }]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor="rgba(255,255,255,0.6)" />}
            ListEmptyComponent={<CenterMessage message={isToday ? '오늘 첫 인사를 남겨 보세요.' : '이 날은 인사가 없어요.'} />}
            renderItem={({ item }) => <GreetingRow greeting={item} onLongPress={openMenu} />}
          />
          {isToday && (
            <View style={[styles.inputArea, { paddingBottom: insets.bottom + 8 }]}>
              {data?.greetedToday ? <Text style={styles.done}>오늘 인사 완료 · 내 인사는 길게 눌러 지울 수 있어요</Text> : (
                <View style={styles.inputRow}>
                  <TextInput value={text} onChangeText={value => setText(value.replace(/\n/g, ' '))} maxLength={LIMITS.greetingMax}
                    onSubmitEditing={send} returnKeyType="send" placeholder={`오늘 인사 한 줄 (${LIMITS.greetingMax}자)`} placeholderTextColor="rgba(255,255,255,0.4)" style={styles.input} />
                  <Pressable accessibilityRole="button" onPress={send} disabled={!text.trim() || sending} style={({ pressed }) => [styles.send, (!text.trim() || pressed) && { opacity: 0.5 }]}>
                    {sending ? <ActivityIndicator color="#032A36" /> : <Text style={styles.sendText}>등록</Text>}
                  </Pressable>
                </View>
              )}
            </View>
          )}
        </View>
      )}
      {menu.element}
    </KeyboardAvoidingView>
  );
}

// 6장 오른쪽: 날짜마다 그날 인사 건수, 누르면 그날 목록. 오늘 이후는 고를 수 없음
function GreetingCalendar({ day, today, onPick }: { day: string; today: string; onPick: (day: string) => void }) {
  const [month, setMonth] = useState(day.slice(0, 7));
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    let active = true;
    setCounts(null);
    api.getGreetingCalendar(month).then(r => { if (active) setCounts(r.days); }).catch(() => { if (active) setCounts({}); });
    return () => { active = false; };
  }, [month]);
  const [year, m] = month.split('-').map(Number);
  return (
    <View style={styles.calendar}>
      <View style={styles.monthBar}>
        <Pressable accessibilityLabel="이전 달" onPress={() => setMonth(shiftMonth(month, -1))} hitSlop={10}><Ionicons name="chevron-back" size={22} color="white" /></Pressable>
        <Text style={styles.dayText}>{year}년 {m}월</Text>
        <Pressable accessibilityLabel="다음 달" disabled={month >= today.slice(0, 7)} onPress={() => setMonth(shiftMonth(month, 1))} hitSlop={10}
          style={month >= today.slice(0, 7) && { opacity: 0.25 }}><Ionicons name="chevron-forward" size={22} color="white" /></Pressable>
      </View>
      <View style={styles.week}>{WEEKDAYS.map(w => <Text key={w} style={styles.weekday}>{w}</Text>)}</View>
      <View style={styles.grid}>
        {monthCells(month).map((cell, i) => {
          if (!cell) return <View key={`e${i}`} style={styles.cell} />;
          const future = cell > today;
          const count = counts?.[cell] ?? 0;
          return (
            <Pressable key={cell} disabled={future} onPress={() => onPick(cell)} style={[styles.cell, future && { opacity: 0.3 }]}>
              <View style={[styles.dateCircle, cell === day && styles.selected]}>
                <Text style={[styles.date, cell === day && styles.selectedText]}>{Number(cell.slice(8))}</Text>
              </View>
              <Text style={styles.cellCount}>{count ? `${count}건` : ''}</Text>
            </Pressable>
          );
        })}
      </View>
      {!counts && <ActivityIndicator color="rgba(255,255,255,0.5)" style={{ marginTop: 12 }} />}
      <Text style={styles.calendarHint}>날짜마다 그날 인사 건수예요. 누르면 그날 목록으로 가요.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  dayBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 20, marginBottom: 10, padding: 12, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.08)' },
  dayCenter: { alignItems: 'center', gap: 2 },
  dayText: { fontFamily: 'SUIT-Bold', fontSize: 16, color: 'white' },
  count: { fontFamily: 'SUIT-SemiBold', fontSize: 13, color: Colors.brand.accent },
  list: { paddingHorizontal: 20, paddingBottom: 16, gap: 8 },
  inputArea: { paddingHorizontal: 16, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.15)' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, height: 44, borderRadius: 14, backgroundColor: '#0F3D6E', color: 'white', paddingHorizontal: 14, fontFamily: 'SUIT-Regular', fontSize: 14 },
  send: { height: 44, paddingHorizontal: 16, borderRadius: 14, backgroundColor: Colors.brand.accent, alignItems: 'center', justifyContent: 'center' },
  sendText: { fontFamily: 'SUIT-Bold', fontSize: 14, color: '#032A36' },
  done: { fontFamily: 'SUIT-SemiBold', fontSize: 13, color: 'rgba(255,255,255,0.6)', textAlign: 'center', paddingVertical: 12 },
  calendar: { marginHorizontal: 20, padding: 14, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)' },
  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  week: { flexDirection: 'row' },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.5)', paddingBottom: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 4, minHeight: 50 },
  dateCircle: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  selected: { backgroundColor: Colors.brand.accent },
  date: { fontFamily: 'SUIT-SemiBold', fontSize: 14, color: 'white' },
  selectedText: { color: '#032A36' },
  cellCount: { fontFamily: 'SUIT-Regular', fontSize: 10, color: Colors.brand.accent, marginTop: 2 },
  calendarHint: { fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 10, textAlign: 'center' },
});
