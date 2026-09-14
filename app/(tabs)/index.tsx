import React, { useState, useCallback, useRef, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Colors from '@/constants/Colors';
import Calendar from '@/components/Calendar';
import { api, Schedule } from '@/services/api';

const LEVEL_COLORS: Record<string, string> = {
  '0': '#ADB5BD',
  '1': '#E53030',
  '2': '#FFE500',
  '3': '#33CC33',
  '4': '#F5F5F5',
  '5': '#3B92C5',
  'A': '#7B2FBE',
};

function schedulesToEvents(schedules: Schedule[]) {
  return schedules.map((s) => ({
    date: s.scheduleDate,
    title: s.title,
    color: LEVEL_COLORS[String(s.minLevel ?? '')] ?? 'rgba(255,255,255,0.3)',
  }));
}

type EventItem = { date: string; title: string; color: string };
type FriendGroup = { id: number; name: string; memberCount: number };

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
  const [filter, setFilter] = useState<string>('mine');
  const [groups, setGroups] = useState<FriendGroup[]>([]);
  const currentMonth = useRef({ year: new Date().getFullYear(), month: new Date().getMonth() });
  const cache = useRef<Map<string, EventItem[]>>(new Map());

  const filterOptions = useMemo(() => [
    { key: 'mine', label: '내 일정' },
    { key: 'instructor', label: '강사 일정' },
    { key: 'closeFriend', label: '친한친구 일정' },
    ...groups.map((g) => ({ key: `group_${g.id}`, label: g.name })),
  ], [groups]);

  const fetchAndCache = useCallback((year: number, month: number) => {
    const key = monthKey(year, month) + `_${filter}`;
    return api.getMonthlySchedules(year, month + 1, filter)
      .then((res) => {
        const items = schedulesToEvents(res.schedules ?? []);
        cache.current.set(key, items);
        return items;
      })
      .catch(() => [] as EventItem[]);
  }, [filter]);

  const prefetchAdjacent = useCallback((year: number, month: number) => {
    adjacentMonths(year, month).forEach(({ year: y, month: m }) => {
      if (!cache.current.has(monthKey(y, m) + `_${filter}`)) {
        fetchAndCache(y, m);
      }
    });
  }, [fetchAndCache, filter]);

  const handleMonthChange = useCallback((year: number, month: number) => {
    currentMonth.current = { year, month };
    const key = monthKey(year, month) + `_${filter}`;
    const cached = cache.current.get(key);
    if (cached) {
      setEvents(cached);
    }
    fetchAndCache(year, month).then((items) => {
      if (currentMonth.current.year === year && currentMonth.current.month === month) {
        setEvents(items);
      }
    });
    prefetchAdjacent(year, month);
  }, [fetchAndCache, prefetchAdjacent, filter]);

  const handleFilterChange = useCallback((newFilter: string) => {
    setFilter(newFilter);
  }, []);

  useFocusEffect(
    useCallback(() => {
      api.getFriendGroups()
        .then((res) => setGroups(res.groups ?? []))
        .catch(() => {});

      const { year, month } = currentMonth.current;
      cache.current.clear();
      handleMonthChange(year, month);
    }, [handleMonthChange])
  );

  return (
    <View style={styles.container}>
      <Calendar
        events={events}
        onDatePress={(date) => router.push({ pathname: '/schedule-daily', params: { date } })}
        onMonthChange={handleMonthChange}
        scheduleFilter={filter}
        onFilterChange={handleFilterChange}
        filterOptions={filterOptions}
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
