import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, SectionList, Pressable, ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/Colors';
import { api, Schedule } from '@/services/api';

const DAY_NAMES = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

const LEVEL_COLORS: Record<string, string> = {
  '0': '#ADB5BD',
  '1': '#E53030',
  '2': '#FFE500',
  '3': '#33CC33',
  '4': '#F5F5F5',
  '5': '#3B92C5',
  'A': '#7B2FBE',
};

type DateSection = {
  title: string;
  data: Schedule[];
};

function formatSectionTitle(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const dow = DAY_NAMES[d.getDay()];
  return `${m}월 ${day}일 (${dow})`;
}

function formatTime(h: number, m: number): string {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getYearMonth(offset: number, base: Date = new Date()): { year: number; month: number } {
  const d = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

const TAB_BAR_HEIGHT = 56;
const TAB_BAR_PADDING = 40; // paddingHorizontal of tab bar container

export default function TabB() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomSpace = TAB_BAR_HEIGHT + (insets.bottom / 2) + 20;
  const [scheduleMap, setScheduleMap] = useState<Map<string, Schedule[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const monthOffsetRef = useRef({ min: 0, max: 0 });

  const loadedMonthsRef = useRef<Set<string>>(new Set());

  const fetchMonth = useCallback(async (year: number, month: number, force = false) => {
    const key = `${year}-${month}`;
    if (!force && loadedMonthsRef.current.has(key)) return;

    try {
      const res = await api.getMonthlySchedules(year, month);
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
    } catch {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      const refresh = async () => {
        const cur = getYearMonth(0);
        // 이미 로드된 모든 월을 다시 가져옴
        if (loadedMonthsRef.current.size === 0) {
          setLoading(true);
          await fetchMonth(cur.year, cur.month, true);
          setLoading(false);
        } else {
          const months = Array.from(loadedMonthsRef.current);
          await Promise.all(months.map((k) => {
            const [y, m] = k.split('-').map(Number);
            return fetchMonth(y, m, true);
          }));
        }
      };
      refresh();
    }, [fetchMonth])
  );

  const sections = useMemo((): DateSection[] => {
    const sortedDates = Array.from(scheduleMap.keys()).sort();
    // 오늘 이후 날짜만 표시 (과거 일정은 위로 스크롤 시 로드)
    return sortedDates.map((date) => ({
      title: formatSectionTitle(date),
      date,
      data: scheduleMap.get(date)!.sort((a, b) => {
        if (a.startHour !== b.startHour) return a.startHour - b.startHour;
        return a.startMinute - b.startMinute;
      }),
    })) as (DateSection & { date: string })[];
  }, [scheduleMap]);

  const MAX_FUTURE_MONTHS = 3;

  const handleLoadMore = useCallback(async () => {
    if (loadingMore) return;
    if (monthOffsetRef.current.max >= MAX_FUTURE_MONTHS) return;
    setLoadingMore(true);
    monthOffsetRef.current.max += 1;
    const next = getYearMonth(monthOffsetRef.current.max);
    await fetchMonth(next.year, next.month);
    setLoadingMore(false);
  }, [loadingMore, fetchMonth]);

  const handleLoadPrevious = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    monthOffsetRef.current.min -= 1;
    const prev = getYearMonth(monthOffsetRef.current.min);
    await fetchMonth(prev.year, prev.month);
    setLoadingMore(false);
  }, [loadingMore, fetchMonth]);

  const renderScheduleItem = ({ item }: { item: Schedule }) => {
    const time = formatTime(item.startHour, item.startMinute);
    const names = item.participantNames?.join(', ');
    const summary = names ? `${item.title} (${names})` : item.title;
    const levelColor = LEVEL_COLORS[String(item.minLevel ?? '')] ?? 'rgba(255,255,255,0.2)';

    return (
      <Pressable
        style={({ pressed }) => [styles.scheduleCard, pressed && { opacity: 0.7 }]}
        onPress={() => router.push({ pathname: '/schedule-detail', params: { id: String(item.id) } })}
      >
        <View style={[styles.levelBar, { backgroundColor: levelColor }]} />
        <Text style={styles.scheduleText}>
          {time}  |  {summary}
        </Text>
      </Pressable>
    );
  };

  const renderSectionHeader = ({ section }: { section: DateSection }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
    </View>
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
      <Text style={styles.loadPrevText}>이전 일정 불러오기</Text>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingArea}>
          <ActivityIndicator size="large" color="rgba(255,255,255,0.5)" />
        </View>
      ) : (
        <>
          <SectionList
            sections={sections}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderScheduleItem}
            renderSectionHeader={renderSectionHeader}
            ListHeaderComponent={ListHeader}
            ListFooterComponent={ListFooter}
            ListEmptyComponent={
              <View style={styles.emptyArea}>
                <Text style={styles.emptyText}>예정된 일정이 없습니다.</Text>
              </View>
            }
            stickySectionHeadersEnabled={true}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.3}
            windowSize={7}
            maxToRenderPerBatch={15}
            removeClippedSubviews={true}
            contentContainerStyle={[styles.listContent, { paddingBottom: bottomSpace + 70 }]}
            showsVerticalScrollIndicator={false}
          />
          <View style={[styles.bottomArea, { bottom: bottomSpace }]}>
            <Pressable
              style={({ pressed }) => [styles.addButton, pressed && { opacity: 0.85 }]}
              onPress={() => router.push({ pathname: '/schedule-add', params: { date: '' } })}
            >
              <Text style={styles.addButtonText}>다이빙 만들기</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
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
  addButton: {
    height: 54,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    fontFamily: 'SUIT-Bold',
    fontSize: 16,
    color: Colors.brand.white,
  },
});
