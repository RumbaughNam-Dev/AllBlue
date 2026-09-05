import React, { useState, useCallback, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Colors from '@/constants/Colors';
import Calendar from '@/components/Calendar';
import { api, Schedule } from '@/services/api';

const CATEGORY_COLORS: Record<string, string> = {
  EXPERIENCE: '#4DA8FF',
  CERTIFICATION: '#FFD43B',
  LECTURE: '#63E6BE',
  TRAINING: '#FF8787',
  FUN_DIVE: '#DA77F2',
  ETC: '#ADB5BD',
};

function schedulesToEvents(schedules: Schedule[]) {
  return schedules.map((s) => ({
    date: s.scheduleDate,
    title: s.title,
    color: CATEGORY_COLORS[s.categoryCode] ?? CATEGORY_COLORS.ETC,
  }));
}

type EventItem = { date: string; title: string; color: string };

function monthKey(year: number, month: number) {
  return `${year}-${month}`;
}

function adjacentMonths(year: number, month: number) {
  return [
    month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 },
    month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 },
  ];
}

export default function TabA() {
  const router = useRouter();
  const [events, setEvents] = useState<EventItem[]>([]);
  const currentMonth = useRef({ year: new Date().getFullYear(), month: new Date().getMonth() });
  const cache = useRef<Map<string, EventItem[]>>(new Map());

  const fetchAndCache = useCallback((year: number, month: number) => {
    const key = monthKey(year, month);
    return api.getMonthlySchedules(year, month + 1)
      .then((res) => {
        const items = schedulesToEvents(res.schedules ?? []);
        cache.current.set(key, items);
        return items;
      })
      .catch(() => [] as EventItem[]);
  }, []);

  const prefetchAdjacent = useCallback((year: number, month: number) => {
    adjacentMonths(year, month).forEach(({ year: y, month: m }) => {
      if (!cache.current.has(monthKey(y, m))) {
        fetchAndCache(y, m);
      }
    });
  }, [fetchAndCache]);

  const handleMonthChange = useCallback((year: number, month: number) => {
    currentMonth.current = { year, month };
    const key = monthKey(year, month);
    const cached = cache.current.get(key);
    if (cached) {
      setEvents(cached);
    }
    // 캐시 유무와 관계없이 최신 데이터 조회
    fetchAndCache(year, month).then((items) => {
      if (currentMonth.current.year === year && currentMonth.current.month === month) {
        setEvents(items);
      }
    });
    prefetchAdjacent(year, month);
  }, [fetchAndCache, prefetchAdjacent]);

  useFocusEffect(
    useCallback(() => {
      const { year, month } = currentMonth.current;
      // 포커스 시 캐시 무효화 후 새로 조회
      cache.current.delete(monthKey(year, month));
      handleMonthChange(year, month);
    }, [handleMonthChange])
  );

  return (
    <View style={styles.container}>
      <Calendar
        events={events}
        onDatePress={(date) => router.push({ pathname: '/schedule-daily', params: { date } })}
        onMonthChange={handleMonthChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brand.primary,
  },
});
