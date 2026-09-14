import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, useWindowDimensions, LayoutChangeEvent, PanResponder, Animated, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/Colors';
import MonthPicker from '@/components/MonthPicker';
import Spinner from '@/components/Spinner';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const MAX_WEEKS = 6;

type Event = {
  date: string; // YYYY-MM-DD
  title: string;
  color: string;
};

type FilterOption = { key: string; label: string };

type Props = {
  events?: Event[];
  onDatePress?: (date: string) => void;
  onMonthChange?: (year: number, month: number) => void;
  scheduleFilter?: string;
  onFilterChange?: (filter: string) => void;
  filterOptions?: FilterOption[];
};

const DEFAULT_FILTERS: FilterOption[] = [
  { key: 'mine', label: '내 일정' },
  { key: 'instructor', label: '강사 일정' },
  { key: 'closeFriend', label: '친한친구 일정' },
];

export default function Calendar({ events = [], onDatePress, onMonthChange, scheduleFilter = 'mine', onFilterChange, filterOptions }: Props) {
  const filters = filterOptions ?? DEFAULT_FILTERS;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const TAB_BAR_HEIGHT = 56 + insets.bottom / 2 + 4 + 16; // tabRow + padding + extra
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [gridHeight, setGridHeight] = useState(0);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const weeks: (number | null)[][] = [];
  let currentWeek: (number | null)[] = Array(firstDay).fill(null);

  for (let d = 1; d <= daysInMonth; d++) {
    currentWeek.push(d);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }

  const cellWidth = width / 7;
  const rowHeight = gridHeight > 0 ? gridHeight / MAX_WEEKS : 80;

  // 이벤트 영역에 몇 개 표시할 수 있는지 계산 (날짜 숫자 24px + 여백)
  const maxVisibleEvents = Math.max(1, Math.floor((rowHeight - 32) / 16));

  const getEventsForDay = useCallback((day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter((e) => e.date === dateStr);
  }, [events, year, month]);

  const prevMonth = () => {
    const newYear = month === 0 ? year - 1 : year;
    const newMonth = month === 0 ? 11 : month - 1;
    setYear(newYear);
    setMonth(newMonth);
    onMonthChange?.(newYear, newMonth);
  };

  const nextMonth = () => {
    const newYear = month === 11 ? year + 1 : year;
    const newMonth = month === 11 ? 0 : month + 1;
    setYear(newYear);
    setMonth(newMonth);
    onMonthChange?.(newYear, newMonth);
  };

  const [calendarReady, setCalendarReady] = useState(true);

  const handleMonthSelect = (y: number, m: number) => {
    setCalendarReady(false);
    setYear(y);
    setMonth(m);
    setShowMonthPicker(false);
    onMonthChange?.(y, m);
    setTimeout(() => setCalendarReady(true), 50);
  };

  const onGridLayout = (e: LayoutChangeEvent) => {
    setGridHeight(e.nativeEvent.layout.height);
  };

  const slideAnim = useRef(new Animated.Value(0)).current;
  const swiping = useRef(false);
  const prevMonthRef = useRef(prevMonth);
  const nextMonthRef = useRef(nextMonth);
  prevMonthRef.current = prevMonth;
  nextMonthRef.current = nextMonth;

  const slideToMonth = useCallback((direction: 'prev' | 'next') => {
    if (swiping.current) return;
    swiping.current = true;
    const slideOut = direction === 'next' ? -width : width;
    const slideIn = direction === 'next' ? width : -width;

    Animated.timing(slideAnim, {
      toValue: slideOut, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true,
    }).start(() => {
      if (direction === 'prev') prevMonthRef.current();
      else nextMonthRef.current();
      slideAnim.setValue(slideIn);
      Animated.timing(slideAnim, {
        toValue: 0, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }).start(() => { swiping.current = false; });
    });
  }, [width, slideAnim]);

  const slideToMonthRef = useRef(slideToMonth);
  slideToMonthRef.current = slideToMonth;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 15 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5,
      onPanResponderRelease: (_, gs) => {
        if (gs.dx > 50) slideToMonthRef.current('prev');
        else if (gs.dx < -50) slideToMonthRef.current('next');
      },
    })
  ).current;

  if (showMonthPicker) {
    return (
      <View style={styles.container}>
        <MonthPicker currentYear={year} currentMonth={month} onSelect={handleMonthSelect} />
        <Pressable
          style={({ pressed }) => [styles.floatingClose, pressed && { opacity: 0.6 }]}
          onPress={() => setShowMonthPicker(false)}
        >
          <Text style={styles.floatingCloseText}>✕</Text>
        </Pressable>
      </View>
    );
  }

  if (!calendarReady) {
    return (
      <View style={styles.container}>
        <View style={styles.spinnerArea}>
          <Spinner />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={prevMonth} style={({ pressed }) => [styles.arrowButton, pressed && { opacity: 0.5 }]}>
          <Text style={styles.arrowText}>{'<'}</Text>
        </Pressable>

        <Pressable onPress={() => setShowMonthPicker(true)} style={({ pressed }) => [styles.monthCenter, pressed && { opacity: 0.6 }]}>
          <Text style={styles.yearLabel}>{year}년</Text>
          <Text style={styles.monthText}>{month + 1}월</Text>
        </Pressable>

        <Pressable onPress={nextMonth} style={({ pressed }) => [styles.arrowButton, pressed && { opacity: 0.5 }]}>
          <Text style={styles.arrowText}>{'>'}</Text>
        </Pressable>
      </View>

      {/* Schedule Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        style={styles.filterScroll}
      >
        {filters.map((opt) => (
          <Pressable
            key={opt.key}
            style={[styles.filterItem, scheduleFilter === opt.key && styles.filterItemActive]}
            onPress={() => onFilterChange?.(opt.key)}
          >
            <Text style={[styles.filterText, scheduleFilter === opt.key && styles.filterTextActive]}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Weekday Headers */}
      <View style={styles.weekdayRow}>
        {WEEKDAYS.map((day, i) => (
          <View key={day} style={[styles.weekdayCell, { width: cellWidth }]}>
            <Text style={[
              styles.weekdayText,
              i === 0 && styles.sundayText,
              i === 6 && styles.saturdayText,
            ]}>{day}</Text>
          </View>
        ))}
      </View>

      <View style={styles.divider} />

      {/* Calendar Grid - fills remaining space */}
      <Animated.View style={[styles.gridArea, { marginBottom: TAB_BAR_HEIGHT, transform: [{ translateX: slideAnim }] }]} onLayout={onGridLayout} {...panResponder.panHandlers}>
        {weeks.map((week, wi) => (
          <View key={wi}>
            <View style={[styles.weekRow, { height: rowHeight }]}>
              {week.map((day, di) => {
                if (day === null) {
                  return <View key={di} style={{ width: cellWidth }} />;
                }

                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isToday = dateStr === todayStr;
                const dayEvents = getEventsForDay(day);
                const visibleEvents = dayEvents.slice(0, maxVisibleEvents);
                const remaining = dayEvents.length - visibleEvents.length;

                return (
                  <Pressable
                    key={di}
                    style={[styles.dayCell, { width: cellWidth }]}
                    onPress={() => onDatePress?.(dateStr)}
                  >
                    <View style={[styles.dayNumberWrap, isToday && styles.todayWrap]}>
                      <Text style={[
                        styles.dayNumber,
                        isToday && styles.todayNumber,
                        di === 0 && styles.sundayText,
                        di === 6 && styles.saturdayText,
                      ]}>{day}</Text>
                    </View>
                    <View style={styles.eventArea}>
                      {visibleEvents.map((ev, ei) => (
                        <View key={ei} style={styles.eventRow}>
                          <View style={[styles.eventDot, { backgroundColor: ev.color }]} />
                          <Text style={styles.eventText} numberOfLines={1}>{ev.title}</Text>
                        </View>
                      ))}
                      {remaining > 0 && (
                        <Text style={styles.eventMore}>+{remaining}</Text>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
            {wi < weeks.length - 1 && <View style={styles.weekDivider} />}
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  arrowButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    fontFamily: 'SUIT-Bold',
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
  },
  monthCenter: {
    alignItems: 'center',
  },
  yearLabel: {
    fontFamily: 'SUIT-Regular',
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 2,
  },
  monthText: {
    fontFamily: 'SUIT-Bold',
    fontSize: 28,
    color: Colors.brand.white,
  },
  filterScroll: {
    flexGrow: 0,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 16,
    paddingRight: 16,
    paddingBottom: 10,
  },
  filterItem: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  filterItemActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  filterText: {
    fontFamily: 'SUIT-SemiBold',
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
  },
  filterTextActive: {
    color: Colors.brand.white,
  },
  weekdayRow: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  weekdayCell: {
    alignItems: 'center',
  },
  weekdayText: {
    fontFamily: 'SUIT-SemiBold',
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
  },
  sundayText: {
    color: '#FF6B6B',
  },
  saturdayText: {
    color: '#4DA8FF',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  gridArea: {
    flex: 1,
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  dayCell: {
    paddingTop: 4,
    paddingBottom: 2,
  },
  dayNumberWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  todayWrap: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  dayNumber: {
    fontFamily: 'SUIT-Regular',
    fontSize: 14,
    color: Colors.brand.white,
  },
  todayNumber: {
    fontFamily: 'SUIT-Bold',
    color: Colors.brand.white,
  },
  eventArea: {
    marginTop: 2,
    paddingHorizontal: 2,
    gap: 1,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  eventDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  eventText: {
    fontFamily: 'SUIT-Regular',
    fontSize: 8,
    color: 'rgba(255,255,255,0.6)',
    flex: 1,
  },
  eventMore: {
    fontFamily: 'SUIT-SemiBold',
    fontSize: 8,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
  },
  spinnerArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingClose: {
    position: 'absolute',
    top: 12,
    right: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingCloseText: {
    fontSize: 20,
    color: Colors.brand.white,
  },
});
