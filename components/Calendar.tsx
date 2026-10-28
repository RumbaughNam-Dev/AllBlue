import { getTabBarContentClearance } from '@/utils/tabBarLayout';
import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, useWindowDimensions, LayoutChangeEvent, PanResponder, Animated, Easing, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/Colors';
import MonthPicker from '@/components/MonthPicker';
import Spinner from '@/components/Spinner';
import AdSlot from '@/components/AdSlot';
import GlassBackground, { glassClear } from '@/components/GlassBackground';
import GlassCircle from '@/components/GlassCircle';
import { AD_IMAGES, AD_LINKS } from '@/constants/Ads';
import type { CalendarEvent } from '@/services/api';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const MAX_WEEKS = 6;
const AD_BAR_HEIGHT = 15;

// 막대 색이 밝으면 진한 글씨, 어두우면 흰 글씨
function readableOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})/i.exec(hex);
  if (!m) return '#FFFFFF';
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#2B1800' : '#FFFFFF';
}

type Event = {
  date: string; // YYYY-MM-DD
  title: string;
  color: string;
  requested?: boolean;
};

type FilterOption = { key: string; label: string };

type Props = {
  events?: Event[];
  calendarEvents?: CalendarEvent[];
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

export default function Calendar({ events = [], calendarEvents = [], onDatePress, onMonthChange, scheduleFilter = 'mine', onFilterChange, filterOptions }: Props) {
  const filters = filterOptions ?? DEFAULT_FILTERS;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const bottomSpace = getTabBarContentClearance(insets.bottom, Platform.OS);
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
  const rowHeight = gridHeight > 0 ? (gridHeight - (MAX_WEEKS - 1)) / MAX_WEEKS : 80;

  // 이벤트 영역에 몇 개 표시할 수 있는지 계산 (날짜 숫자 24px + 여백)
  const maxVisibleEvents = Math.max(1, Math.floor((rowHeight - 32) / 16));

  const getEventsForDay = useCallback((day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter((e) => e.date === dateStr);
  }, [events, year, month]);

  const dateKey = (day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const findAdEvent = (dateStr: string) => calendarEvents.find((e) => e.startDate <= dateStr && dateStr <= e.endDate);

  // 한 주 안에서 이벤트 구간을 이어 붙인 박스. 주를 넘어가면 끊긴 쪽 테두리를 열어 둔다.
  const getAdSegments = (week: (number | null)[]) => calendarEvents.flatMap((ev) => {
    const cols = week
      .map((day, di) => (day !== null && ev.startDate <= dateKey(day) && dateKey(day) <= ev.endDate ? di : -1))
      .filter((di) => di >= 0);
    if (cols.length === 0) return [];
    const startCol = cols[0];
    const endCol = cols[cols.length - 1];
    return [{
      ev, startCol, span: endCol - startCol + 1,
      openLeft: dateKey(week[startCol]!) > ev.startDate,
      openRight: dateKey(week[endCol]!) < ev.endDate,
    }];
  });

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
          style={({ pressed }) => [styles.floatingClose, glassClear, pressed && { opacity: 0.6 }]}
          onPress={() => setShowMonthPicker(false)}
        >
          <GlassBackground radius={16} interactive />
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
        <Pressable onPress={prevMonth} style={({ pressed }) => pressed && { opacity: 0.5 }}>
          <GlassCircle fallbackStyle={styles.arrowButton}>
            <Text style={styles.arrowText}>{'<'}</Text>
          </GlassCircle>
        </Pressable>

        <Pressable onPress={() => setShowMonthPicker(true)} style={({ pressed }) => [styles.monthCenter, pressed && { opacity: 0.6 }]}>
          <Text style={styles.yearLabel}>{year}년</Text>
          <Text style={styles.monthText}>{month + 1}월</Text>
        </Pressable>

        <Pressable onPress={nextMonth} style={({ pressed }) => pressed && { opacity: 0.5 }}>
          <GlassCircle fallbackStyle={styles.arrowButton}>
            <Text style={styles.arrowText}>{'>'}</Text>
          </GlassCircle>
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
            style={[styles.filterItem, scheduleFilter === opt.key && styles.filterItemActive, glassClear]}
            onPress={() => onFilterChange?.(opt.key)}
          >
            <GlassBackground radius={16} interactive tintColor={scheduleFilter === opt.key ? 'rgba(255,255,255,0.22)' : undefined} />
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
      {/* Grid 6 : Ad 1 — ad height equals one week row */}
      <View style={[styles.gridWithAd, { marginBottom: bottomSpace }]}>
      <Animated.View style={[styles.gridArea, { transform: [{ translateX: slideAnim }] }]} onLayout={onGridLayout} {...panResponder.panHandlers}>
        {weeks.map((week, wi) => (
          <View key={wi}>
            <View style={[styles.weekRow, { height: rowHeight }]}>
              {week.map((day, di) => {
                if (day === null) {
                  return <View key={di} style={{ width: cellWidth }} />;
                }

                const dateStr = dateKey(day);
                const isToday = dateStr === todayStr;
                const adEvent = findAdEvent(dateStr);
                const dayEvents = getEventsForDay(day);
                // 이벤트 띠가 차지하는 한 줄만큼 일정 줄을 비워 둔다
                const visibleEvents = dayEvents.slice(0, adEvent ? Math.max(0, maxVisibleEvents - 1) : maxVisibleEvents);
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
                      {adEvent && <View style={styles.adBarSpace} />}
                      {visibleEvents.map((ev, ei) => (
                        <View key={ei} style={styles.eventRow}>
                          <View style={[styles.eventDot, { backgroundColor: ev.color }]} />
                          <Text style={[styles.eventText, ev.requested && { color: '#FFD166', fontWeight: '700', backgroundColor: 'rgba(255,209,102,0.18)' }]} numberOfLines={1}>{ev.title}</Text>
                        </View>
                      ))}
                      {remaining > 0 && (
                        <Text style={styles.eventMore}>+{remaining}</Text>
                      )}
                    </View>
                  </Pressable>
                );
              })}
              {getAdSegments(week).map(({ ev, startCol, span, openLeft, openRight }) => {
                // 이름은 시작하는 막대에만(지난달에 시작했으면 이번 달 첫 막대에) 넣는다
                const showTitle = !openLeft || week[startCol] === 1;
                return (
                  <View
                    key={ev.id}
                    pointerEvents="none"
                    style={[
                      styles.adBar,
                      {
                        backgroundColor: ev.borderColor,
                        left: startCol * cellWidth + (openLeft ? 0 : 3),
                        width: span * cellWidth - (openLeft ? 0 : 3) - (openRight ? 0 : 3),
                      },
                      openLeft && styles.adBarOpenLeft,
                      openRight && styles.adBarOpenRight,
                    ]}
                  >
                    {showTitle && (
                      <Text style={[styles.adBarText, { color: readableOn(ev.borderColor) }]} numberOfLines={1}>
                        {!openLeft ? '🎉 ' : ''}{ev.title}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
            {wi < weeks.length - 1 && <View style={styles.weekDivider} />}
          </View>
        ))}
      </Animated.View>
      <AdSlot source={AD_IMAGES.calendar} url={AD_LINKS.calendar} style={styles.ad} />
      </View>
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
  gridWithAd: {
    flex: 1,
  },
  gridArea: {
    flex: MAX_WEEKS,
  },
  ad: {
    flex: 1,
    marginHorizontal: 16,
    marginTop: 8,
  },
  weekRow: {
    flexDirection: 'row',
  },
  // 날짜 광고 이벤트 띠: 기간 전체에 이어지는 색 막대. 날짜 숫자 바로 아래, 일정 줄 맨 위에 놓인다.
  adBar: {
    position: 'absolute',
    top: 4 + 26 + 2,
    height: AD_BAR_HEIGHT,
    borderRadius: AD_BAR_HEIGHT / 2,
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  // 주가 바뀌어 이어지는 쪽은 둥글리지 않아 한 줄로 이어져 보이게 한다
  adBarOpenLeft: {
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  adBarOpenRight: {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  adBarText: {
    fontFamily: 'SUIT-Bold',
    fontSize: 9,
  },
  adBarSpace: {
    height: AD_BAR_HEIGHT,
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
