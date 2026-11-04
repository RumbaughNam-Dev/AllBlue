import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Easing, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
// 목록(스크롤)과 좌우 밀기가 서로 터치를 나눠 갖도록 제스처 핸들러의 목록 · 새로고침을 씀 (RN 기본 PanResponder는 iOS 스크롤이 터치를 가져가 취소됨)
import { FlatList, GestureDetector, GestureHandlerRootView, RefreshControl, usePanGesture } from 'react-native-gesture-handler';
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
const SWIPE_DISTANCE = 50; // 이만큼 밀면 넘어감 (아니면 제자리로)
const FLICK_VELOCITY = 500; // 짧게 휙 밀어도 넘어감
const EDGE_RESISTANCE = 0.25; // 더 갈 수 없는 쪽(오늘의 다음 날)은 살짝만 따라옴

type DayData = { count: number; greetedToday: boolean; items: CommunityGreeting[] };

export default function GreetingsScreen() {
  const insets = useSafeAreaInsets();
  const [day, setDay] = useState<string | null>(null);
  const [today, setToday] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [calendar, setCalendar] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const request = useRef(0);
  const menu = useContentMenu();

  // 날짜별로 받아 둔 인사. 보고 있는 날의 앞뒤 날짜도 미리 받아 두어 밀거나 ‹ › 를 눌러도 로딩 없이 바로 보임
  const cache = useRef(new Map<string, DayData>());
  const [, setVersion] = useState(0);
  const refresh = () => setVersion(v => v + 1);
  const data = day ? cache.current.get(day) ?? null : null;

  // 같은 날을 미리 받기 · 새로 받기가 동시에 할 때, 늦게 도착한 옛 응답이 새 응답을 덮지 않도록 요청 순서를 날짜별로 기억
  const fetchSeq = useRef(0);
  const cachedSeq = useRef(new Map<string, number>());
  const fetchDay = useCallback(async (target: string | null) => {
    const seq = ++fetchSeq.current;
    const result = await api.getGreetings(target ?? undefined);
    if ((cachedSeq.current.get(result.date) ?? 0) < seq) {
      cachedSeq.current.set(result.date, seq);
      cache.current.set(result.date, { count: result.count, greetedToday: result.greetedToday, items: result.items });
    }
    return result;
  }, []);

  const load = useCallback(async (target = day) => {
    const id = ++request.current;
    try {
      const result = await fetchDay(target);
      if (id !== request.current) { refresh(); return; } // 다른 날로 넘어갔어도 받아 둔 목록은 화면에 반영
      setDay(result.date); setToday(result.today); setError(false);
      refresh();
    } catch {
      if (id === request.current) setError(true);
    }
  }, [day, fetchDay]);
  useEffect(() => { void load(null); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const prefetching = useRef(new Set<string>());
  useEffect(() => {
    if (!day || !today) return;
    // 빠르게 여러 날 넘겨도 로딩이 덜 보이도록 앞뒤 이틀씩
    for (const target of [shiftDay(day, -1), shiftDay(day, 1), shiftDay(day, -2), shiftDay(day, 2)]) {
      if (target > today || cache.current.has(target) || prefetching.current.has(target)) continue;
      prefetching.current.add(target);
      fetchDay(target).then(refresh, () => {}).finally(() => prefetching.current.delete(target));
    }
  }, [day, today, fetchDay]);

  // 달력에서 고른 날: 받아 둔 날이면 바로 보이고 뒤에서 새로 받음
  const go = (target: string) => { setDay(target); setCalendar(false); void load(target); };
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
    onDeleted: () => void load(),
    // 차단하면 다른 날 목록에서도 빠져야 하므로 받아 둔 날을 비움
    onBlocked: () => { cache.current.clear(); cachedSeq.current.clear(); void load(); },
  });

  const isToday = !!day && day === today;
  const isTodayRef = useRef(isToday); isTodayRef.current = isToday;

  // 화면 가운데에서 좌우로 밀면 [전날 | 이 날 | 다음 날] 목록이 손가락을 따라 움직이다 옆 날로 미끄러져 넘어감
  // (오른쪽으로 밀면 전날). ‹ › 버튼도 같은 모양. 왼쪽 끝에서 밀면 화면 닫기(뒤로)는 그대로
  const slide = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);
  const busy = useRef(false);
  const recenter = useRef(false);
  // JS에서 움직임: 넘어간 뒤 가운데로 되돌리는 순간(setValue)이 새 날짜 화면과 같은 때 반영되도록.
  // (네이티브로 돌리면 되돌리기가 늦거나 빠져 옆 칸 — 오늘이면 빈 다음 날 칸 — 이 그대로 보일 수 있음)
  const settle = (toValue: number) => new Promise<void>(resolve => {
    Animated.timing(slide, { toValue, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(() => resolve());
  });
  // 넘어가는 중에 또 밀면 몇 칸 더 갈지 모아 두었다가 한 칸씩 이어서 (전날 +, 다음 날 − 가 서로 상쇄)
  const pending = useRef(0);
  const slideDay = useRef<(dir: -1 | 1) => void>(() => {});
  slideDay.current = async dir => {
    if (busy.current) { pending.current += dir; return; }
    if (!day || !width || (dir === 1 && isToday)) { pending.current = 0; void settle(0); return; }
    busy.current = true;
    const target = shiftDay(day, dir);
    await settle(dir === -1 ? width : -width); // 전날은 왼쪽에서 들어옴
    recenter.current = true; // 옆 칸이 가운데 칸이 되는 순간 위치를 가운데로 (깜빡임 없이)
    setDay(target);
    void load(target); // 받아 둔 날이어도 뒤에서 새로 받음
  };
  useLayoutEffect(() => {
    if (!recenter.current) return;
    recenter.current = false;
    slide.setValue(0);
    busy.current = false;
    if (pending.current) {
      const next = pending.current > 0 ? 1 : -1;
      pending.current -= next;
      slideDay.current(next); // 이 렌더의 slideDay (새 날짜 기준)
    }
  }, [day, slide]);

  const fromEdge = (event: { absoluteX: number; translationX: number }) => event.absoluteX - event.translationX < EDGE_BACK_WIDTH;
  const swipe = usePanGesture({
    runOnJS: true,
    activeOffsetX: [-20, 20], // 옆으로 20pt 넘게 밀면 시작
    failOffsetY: [-15, 15], // 위아래로 먼저 움직이면 목록 스크롤
    onUpdate: event => {
      if (busy.current || fromEdge(event)) return;
      const dx = event.translationX;
      slide.setValue(dx < 0 && isTodayRef.current ? dx * EDGE_RESISTANCE : dx);
    },
    onDeactivate: event => {
      if (fromEdge(event)) return;
      if (busy.current) {
        // 넘어가는 중에 민 것: 방향만 기억 (끝나면 이어서 넘어감)
        if (!event.canceled && Math.abs(event.translationX) > SWIPE_DISTANCE / 2) pending.current += event.translationX > 0 ? -1 : 1;
        return;
      }
      const dx = event.translationX, vx = event.velocityX;
      if (!event.canceled && (dx > SWIPE_DISTANCE || (dx > 10 && vx > FLICK_VELOCITY))) slideDay.current(-1);
      else if (!event.canceled && (dx < -SWIPE_DISTANCE || (dx < -10 && vx < -FLICK_VELOCITY))) slideDay.current(1);
      else void settle(0);
    },
  });

  const prevData = day ? cache.current.get(shiftDay(day, -1)) ?? null : null;
  const nextData = day && !isToday ? cache.current.get(shiftDay(day, 1)) ?? null : null;

  return (
    <KeyboardAvoidingView style={[ui.screen, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <CommunityHeader title="출석인사" right={day && <HeaderButton icon={calendar ? 'list' : 'calendar-outline'} label={calendar ? '목록' : '달력'} onPress={() => setCalendar(c => !c)} />} />
      {!day ? <CenterMessage loading={!error} message="인사를 불러오지 못했어요." onRetry={error ? () => load() : undefined} /> : calendar ? (
        <GreetingCalendar day={day} today={today ?? day} onPick={go} />
      ) : (
        <GestureHandlerRootView style={{ flex: 1 }}>
        <GestureDetector gesture={swipe}>
        <View style={{ flex: 1 }}>
          <View style={styles.dayBar}>
            <Pressable accessibilityLabel="전날" onPress={() => slideDay.current(-1)} hitSlop={10}><Ionicons name="chevron-back" size={22} color="white" /></Pressable>
            <Pressable onPress={() => setCalendar(true)} style={styles.dayCenter}>
              <Text style={styles.dayText}>{dayLabel(day)}{isToday ? ' · 오늘' : ''}</Text>
              <Text style={styles.count}>인사 {data?.count ?? 0}건</Text>
            </Pressable>
            <Pressable accessibilityLabel="다음 날" disabled={isToday} onPress={() => slideDay.current(1)} hitSlop={10} style={isToday && { opacity: 0.25 }}>
              <Ionicons name="chevron-forward" size={22} color="white" />
            </Pressable>
          </View>
          <View style={styles.slideArea} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
            <Animated.View style={[styles.slideRow, { width: width * 3, marginLeft: -width, transform: [{ translateX: slide }] }]}>
              <View style={{ width }}><SidePanel data={prevData} /></View>
              <View style={{ width }}>
                {data ? (
                  <FlatList
                    // 날마다 새 목록 (전날 목록에서 내려 둔 스크롤 위치가 남아 짧은 목록이 빈 화면처럼 보이지 않게)
                    key={day}
                    data={data.items}
                    keyExtractor={g => String(g.id)}
                    contentContainerStyle={[styles.list, !data.items.length && { flexGrow: 1 }]}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor="rgba(255,255,255,0.6)" />}
                    ListEmptyComponent={<CenterMessage message={isToday ? '오늘 첫 인사를 남겨 보세요.' : '이 날은 인사가 없어요.'} />}
                    renderItem={({ item }) => <GreetingRow greeting={item} onLongPress={openMenu} />}
                  />
                ) : <CenterMessage loading={!error} message="인사를 불러오지 못했어요." onRetry={error ? () => load() : undefined} />}
              </View>
              <View style={{ width }}>{!isToday && <SidePanel data={nextData} />}</View>
            </Animated.View>
          </View>
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
        </GestureDetector>
        </GestureHandlerRootView>
      )}
      {menu.element}
    </KeyboardAvoidingView>
  );
}

// 밀 때 옆에 보이는 전날 · 다음 날 목록 (보기만, 아직 못 받았으면 로딩)
function SidePanel({ data }: { data: DayData | null }) {
  if (!data) return <CenterMessage loading message="" />;
  if (!data.items.length) return <CenterMessage message="이 날은 인사가 없어요." />;
  return (
    <View style={[styles.list, { overflow: 'hidden' }]} pointerEvents="none">
      {data.items.slice(0, 20).map(item => <GreetingRow key={item.id} greeting={item} />)}
    </View>
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
  slideArea: { flex: 1, overflow: 'hidden' },
  slideRow: { flex: 1, flexDirection: 'row' },
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
