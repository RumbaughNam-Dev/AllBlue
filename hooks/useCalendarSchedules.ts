import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { AppState } from 'react-native';
import { api, Schedule } from '@/services/api';
import { useLatestRequest } from './useLatestRequest';
import { getScheduleMarkerColor } from '@/utils/scheduleMarker';

type EventItem = { date: string; title: string; color: string; requested?: boolean };
type FriendGroup = { id: number; name: string; memberCount: number };
const toEvents = (schedules: Schedule[]): EventItem[] => schedules.map((s) => ({
  date: s.scheduleDate, title: s.invitationStatus === 'pending' ? `일정등록 요청 · ${s.title}` : s.title, requested: s.invitationStatus === 'pending',
  color: getScheduleMarkerColor(s),
}));

export function useCalendarSchedules() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [filter, setFilter] = useState('mine');
  const [groups, setGroups] = useState<FriendGroup[]>([]);
  const [error, setError] = useState(false);
  const currentMonth = useRef({ year: new Date().getFullYear(), month: new Date().getMonth() });
  const cache = useRef(new Map<string, EventItem[]>());
  const pending = useRef(new Map<string, Promise<EventItem[]>>());
  const epoch = useRef(0);
  const request = useLatestRequest();
  const filterOptions = useMemo(() => [
    { key: 'mine', label: '내 일정' },
    { key: 'instructor', label: '강사 일정' },
    { key: 'closeFriend', label: '친한친구 일정' },
    ...groups.map((g) => ({ key: `group_${g.id}`, label: g.name })),
  ], [groups]);

  const fetchMonth = useCallback((year: number, month: number) => {
    const key = `${year}-${month}_${filter}`;
    const existing = pending.current.get(key);
    if (existing) return existing;
    const version = epoch.current;
    const task = api.getMonthlySchedules(year, month + 1, filter)
      .then((res) => {
        const items = toEvents(res.schedules ?? []);
        if (epoch.current === version) cache.current.set(key, items);
        return items;
      })
      .finally(() => {
        if (pending.current.get(key) === task) pending.current.delete(key);
      });
    pending.current.set(key, task);
    return task;
  }, [filter]);

  const handleMonthChange = useCallback((year: number, month: number) => {
    currentMonth.current = { year, month };
    const isCurrent = request.start();
    setEvents(cache.current.get(`${year}-${month}_${filter}`) ?? []);
    setError(false);
    fetchMonth(year, month)
      .then((items) => { if (isCurrent()) setEvents(items); })
      .catch(() => { if (isCurrent()) setError(true); });
    for (const offset of [-1, 1]) {
      const date = new Date(year, month + offset, 1);
      const y = date.getFullYear();
      const m = date.getMonth();
      if (!cache.current.has(`${y}-${m}_${filter}`)) void fetchMonth(y, m).catch(() => {});
    }
  }, [fetchMonth, filter, request]);

  const handleFilterChange = (value: string) => {
    if (value === filter) return;
    request.invalidate();
    setEvents([]);
    setFilter(value);
  };
  const retry = () => handleMonthChange(currentMonth.current.year, currentMonth.current.month);

  useFocusEffect(useCallback(() => {
    let active = true;
    epoch.current++;
    pending.current.clear();
    api.getFriendGroups().then((res) => {
      if (active) setGroups(res.groups ?? []);
    }).catch(() => {});
    handleMonthChange(currentMonth.current.year, currentMonth.current.month);
    let appState = AppState.currentState;
    const subscription = AppState.addEventListener('change', (nextState) => {
      const resumed = appState !== 'active' && nextState === 'active';
      appState = nextState;
      if (!resumed) return;
      epoch.current++;
      pending.current.clear();
      cache.current.clear();
      handleMonthChange(currentMonth.current.year, currentMonth.current.month);
    });
    return () => {
      active = false;
      subscription.remove();
      request.invalidate();
      epoch.current++;
      pending.current.clear();
    };
  }, [handleMonthChange, request]));

  return { events, filter, filterOptions, error, retry, handleMonthChange, handleFilterChange };
}
