import { getScheduleMarkerColor } from '@/utils/scheduleMarker';
import { getTabBarContentClearance } from '@/utils/tabBarLayout';
import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, SectionList, Pressable, ActivityIndicator, Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAppRouter, usePaneDefault, SplitScene } from '@/features/split/SplitPane';
import { isIPhoneDuo } from '@/utils/foldable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/Colors';
import { api, Schedule } from '@/services/api';
import FloatingActionButton from '@/components/FloatingActionButton';
import GlassChip from '@/components/GlassChip';

const DAY_NAMES = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

type DateSection = {
  key: string;
  title: string;
  data: Schedule[];
  // 이전 일정 묶음의 마지막 섹션. 아래에 '이전 일정 / 다가오는 일정' 구분선을 그린다.
  endsPast?: boolean;
};

function formatSectionTitle(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const dow = DAY_NAMES[d.getDay()];
  return `${m}월 ${day}일 (${dow})`;
}

function scheduleStartMs(s: { scheduleDate: string; startHour: number; startMinute: number }): number {
  const [y, mo, d] = s.scheduleDate.split('-').map(Number);
  return new Date(y, mo - 1, d, s.startHour, s.startMinute).getTime();
}

function formatTime(h: number, m: number): string {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getYearMonth(offset: number, base: Date = new Date()): { year: number; month: number } {
  const d = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}


export default function TabB() {
  const router = useAppRouter();
  usePaneDefault('b', { message: '여기에 일정 상세 내용이 표시돼요', hint: '왼쪽에서 궁금한 다이빙 일정을 눌러 보세요' });
  const insets = useSafeAreaInsets();
  // iPhone Duo uses the system tab bar, which the safe area already clears.
  const bottomSpace = isIPhoneDuo ? insets.bottom : getTabBarContentClearance(insets.bottom, Platform.OS);
  const [scheduleMap, setScheduleMap] = useState<Map<string, Schedule[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const requests = useRef(new Map<string, symbol>());
  const failedMonths = useRef(new Map<string, { year: number; month: number }>());
  const loadingMoreRef = useRef(false);
  const monthOffsetRef = useRef({ min: 0, max: 0 });

  const loadedMonthsRef = useRef<Set<string>>(new Set());
  // 처음엔 지금 시점 이후 일정만 보여준다. '이전 일정 불러오기'를 누르면 해제(null)되고 이전 달을 불러온다.
  const [visibleFrom, setVisibleFrom] = useState<number | null>(() => Date.now());
  // 이전/다가오는 일정을 나누는 기준 시각 (화면을 처음 연 시점)
  const boundaryRef = useRef(visibleFrom ?? Date.now());

  const fetchMonth = useCallback(async (year: number, month: number, force = false) => {
    const key = `${year}-${month}`;
    if (!force && loadedMonthsRef.current.has(key)) return true;
    const requestId = Symbol(key);
    requests.current.set(key, requestId);
    const isCurrent = () => requests.current.get(key) === requestId;

    try {
      const res = await api.getMonthlySchedules(year, month);
      if (!isCurrent()) return false;
      setScheduleMap((prev) => {
        const next = new Map(prev);
        // 해당 월 날짜 데이터 초기화 후 덮어쓰기
        const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
        for (const [k] of next) {
          if (k.startsWith(monthPrefix)) next.delete(k);
        }
        for (const s of res.schedules) {
          const dateKey = s.scheduleDate;
          if (!next.has(dateKey)) next.set(dateKey, []);
          next.get(dateKey)!.push(s);
        }
        return next;
      });
      loadedMonthsRef.current.add(key);
      failedMonths.current.delete(key);
      setLoadError(failedMonths.current.size > 0);
      return true;
    } catch {
      if (isCurrent()) {
        failedMonths.current.set(key, { year, month });
        setLoadError(true);
      }
      return false;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadingMoreRef.current = false;
      setLoadingMore(false);
      const refresh = async () => {
        const cur = getYearMonth(0);
        // 이미 로드된 모든 월을 다시 가져옴
        if (loadedMonthsRef.current.size === 0) {
          setLoading(true);
          await fetchMonth(cur.year, cur.month, true);
          if (active) setLoading(false);
        } else {
          const months = Array.from(loadedMonthsRef.current);
          await Promise.all(months.map((k) => {
            const [y, m] = k.split('-').map(Number);
            return fetchMonth(y, m, true);
          }));
        }
      };
      refresh();
      return () => { active = false; requests.current.clear(); };
    }, [fetchMonth])
  );

  const sections = useMemo((): DateSection[] => {
    const boundary = boundaryRef.current;
    const sortedDates = Array.from(scheduleMap.keys()).sort();
    const past: DateSection[] = [];
    const upcoming: DateSection[] = [];
    for (const date of sortedDates) {
      const items = scheduleMap.get(date)!
        .filter((sc) => visibleFrom === null || scheduleStartMs(sc) >= visibleFrom)
        .sort((a, b) => {
          if (a.startHour !== b.startHour) return a.startHour - b.startHour;
          return a.startMinute - b.startMinute;
        });
      // 같은 날이라도 기준 시각 전후로 나눠 구분선이 정확히 그 사이에 오게 한다
      const before = items.filter((sc) => scheduleStartMs(sc) < boundary);
      const after = items.filter((sc) => scheduleStartMs(sc) >= boundary);
      const title = formatSectionTitle(date);
      if (before.length > 0) past.push({ key: `${date}-past`, title, data: before });
      if (after.length > 0) upcoming.push({ key: date, title, data: after });
    }
    if (past.length > 0 && upcoming.length > 0) past[past.length - 1] = { ...past[past.length - 1], endsPast: true };
    return [...past, ...upcoming];
  }, [scheduleMap, visibleFrom]);

  const MAX_FUTURE_MONTHS = 3;

  const loadDirection = async (direction: 'previous' | 'next') => {
    if (loadingMoreRef.current) return;
    if (direction === 'next' && monthOffsetRef.current.max >= MAX_FUTURE_MONTHS) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const offset = direction === 'next' ? monthOffsetRef.current.max + 1 : monthOffsetRef.current.min - 1;
    const target = getYearMonth(offset);
    const success = await fetchMonth(target.year, target.month);
    if (success) {
      if (direction === 'next') monthOffsetRef.current.max = offset;
      else monthOffsetRef.current.min = offset;
    }
    loadingMoreRef.current = false;
    setLoadingMore(false);
  };
  const handleLoadMore = () => { if (!loadError) void loadDirection('next'); };
  const handleLoadPrevious = () => {
    if (visibleFrom !== null) {
      // 먼저 이미 불러온 이번 달의 지난 일정을 펼치고, 펼칠 게 없으면 바로 이전 달을 불러온다
      const hasHiddenPast = [...scheduleMap.values()].some((list) => list.some((sc) => scheduleStartMs(sc) < visibleFrom));
      setVisibleFrom(null);
      if (hasHiddenPast) return;
    }
    void loadDirection('previous');
  };
  const retry = async () => {
    await Promise.all([...failedMonths.current.values()].map(({ year, month }) => fetchMonth(year, month, true)));
  };

  const renderScheduleItem = ({ item }: { item: Schedule }) => {
    const time = formatTime(item.startHour, item.startMinute);
    const names = item.participantNames?.join(', ');
    const summary = names ? `${item.title} (${names})` : item.title;
    const markerColor = getScheduleMarkerColor(item);

    return (
      <Pressable
        style={({ pressed }) => [styles.scheduleCard, pressed && { opacity: 0.7 }]}
        onPress={() => router.push({ pathname: '/schedule-detail', params: { id: String(item.id) } })}
      >
        <View style={[styles.levelBar, { backgroundColor: markerColor }]} />
        <Text style={styles.scheduleText}>
          {time}  |  {item.participants?.length ? <>
            {item.title} ({item.participants.map((participant, index) => <React.Fragment key={index}>
              {index > 0 ? ', ' : ''}<Text>{participant.nickname}</Text>
            </React.Fragment>)})
          </> : summary}
        </Text>
      </Pressable>
    );
  };

  const renderSectionHeader = ({ section }: { section: DateSection }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
    </View>
  );

  const renderSectionFooter = ({ section }: { section: DateSection }) => (
    section.endsPast ? (
      <View style={styles.pastDivider}>
        <View style={styles.pastDividerLine} />
        <View style={styles.pastDividerPill}>
          <Text style={styles.pastDividerText}>▲ 이전 일정</Text>
          <View style={styles.pastDividerDot} />
          <Text style={[styles.pastDividerText, styles.pastDividerTextNow]}>다가오는 일정 ▼</Text>
        </View>
        <View style={styles.pastDividerLine} />
      </View>
    ) : null
  );

  const ListFooter = () => {
    if (loadingMore) {
      return (
        <View style={styles.loadMoreArea}>
          <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" />
        </View>
      );
    }
    return null;
  };

  const ListHeader = () => (
    <Pressable
      style={({ pressed }) => [styles.loadPrevButton, pressed && { opacity: 0.6 }]}
      onPress={handleLoadPrevious}
    >
      <GlassChip>
        <Text style={styles.loadPrevText}>이전 일정 불러오기</Text>
      </GlassChip>
    </Pressable>
  );

  return (
    <SplitScene tab="b">
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingArea}>
          <ActivityIndicator size="large" color="rgba(255,255,255,0.5)" />
        </View>
      ) : (
        <>
          {loadError && <Pressable onPress={retry} style={{ padding: 16 }}>
            <Text style={styles.emptyText}>일정을 불러오지 못했습니다. 눌러서 다시 시도해주세요.</Text>
          </Pressable>}
          <SectionList
            sections={sections}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderScheduleItem}
            renderSectionHeader={renderSectionHeader}
            renderSectionFooter={renderSectionFooter}
            ListHeaderComponent={ListHeader}
            ListFooterComponent={ListFooter}
            ListEmptyComponent={loadError ? undefined : (
              <View style={styles.emptyArea}>
                <Text style={styles.emptyText}>예정된 일정이 없습니다.</Text>
              </View>
            )}
            stickySectionHeadersEnabled={true}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.3}
            windowSize={7}
            maxToRenderPerBatch={15}
            removeClippedSubviews={true}
            contentContainerStyle={[styles.listContent, { paddingBottom: bottomSpace + 70 }]}
            showsVerticalScrollIndicator={false}
          />
          {/* iPhone Duo shows this in the tab bar's accessory instead */}
          {!isIPhoneDuo && (
            <View style={[styles.bottomArea, { bottom: bottomSpace }]}>
              <FloatingActionButton
                label="다이빙 만들기"
                onPress={() => router.push({ pathname: '/schedule-add', params: { date: '' } })}
                fallbackStyle={styles.addButton}
                fallbackPressedStyle={styles.addButtonPressed}
                fallbackTextStyle={styles.addButtonText}
              />
            </View>
          )}
        </>
      )}
    </View>
    </SplitScene>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brand.primary,
  },
  loadingArea: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  loadPrevButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  loadPrevText: {
    fontFamily: 'SUIT-Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.35)',
  },
  sectionHeader: {
    backgroundColor: Colors.brand.primary,
    paddingVertical: 12,
    paddingTop: 16,
  },
  sectionTitle: {
    fontFamily: 'SUIT-Bold',
    fontSize: 16,
    color: Colors.brand.white,
  },
  pastDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
    marginBottom: 6,
  },
  pastDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  pastDividerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  pastDividerText: {
    fontFamily: 'SUIT-SemiBold',
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
  },
  pastDividerTextNow: {
    color: Colors.brand.white,
  },
  pastDividerDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  scheduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingLeft: 12,
    paddingRight: 16,
    paddingVertical: 14,
    marginBottom: 8,
  },
  levelBar: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 2,
    marginRight: 10,
  },
  scheduleText: {
    fontFamily: 'SUIT-SemiBold',
    fontSize: 14,
    color: Colors.brand.white,
    flex: 1,
  },
  emptyArea: {
    alignItems: 'center', justifyContent: 'center', paddingTop: 60,
  },
  emptyText: {
    fontFamily: 'SUIT-Regular', fontSize: 15, color: 'rgba(255,255,255,0.35)',
  },
  loadMoreArea: {
    paddingVertical: 16, alignItems: 'center',
  },
  bottomArea: {
    position: 'absolute',
    left: 20,
    right: 20,
  },
  // 다른 화면의 주요 버튼(흰 배경 + 남색 글씨)과 통일. 그림자로 목록 위에 떠 보이게 한다.
  addButton: {
    height: 54,
    borderRadius: 14,
    backgroundColor: Colors.brand.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  addButtonPressed: {
    opacity: 0.85,
  },
  addButtonText: {
    fontFamily: 'SUIT-Bold',
    fontSize: 16,
    color: Colors.brand.primary,
  },
});
