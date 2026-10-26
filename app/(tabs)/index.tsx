import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useAppRouter, usePaneDefault, SplitScene } from '@/features/split/SplitPane';
import Colors from '@/constants/Colors';
import Calendar from '@/components/Calendar';
import { useCalendarSchedules } from '@/hooks/useCalendarSchedules';

export default function TabA() {
  const router = useAppRouter();
  const { events, calendarEvents, filter, filterOptions, error, retry, handleMonthChange, handleFilterChange } = useCalendarSchedules();
  const sourceLabel = filter.startsWith('group_')
    ? `${filterOptions.find((option) => option.key === filter)?.label ?? '그룹'} 그룹 일정`
    : filterOptions.find((option) => option.key === filter)?.label ?? '내 일정';
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  // Unfolded with no date picked yet, the right pane shows today's timeline.
  usePaneDefault('index', { pathname: '/schedule-daily', params: { date: today, filter, sourceLabel } });
  return (
    <SplitScene tab="index">
    <View style={styles.container}>
      {error && (
        <Pressable onPress={retry} style={{ padding: 12 }}>
          <Text style={{ color: 'white', textAlign: 'center' }}>일정을 불러오지 못했습니다. 눌러서 다시 시도해주세요.</Text>
        </Pressable>
      )}
      <Calendar
        events={events}
        calendarEvents={calendarEvents}
        onDatePress={(date) => router.push({ pathname: '/schedule-daily', params: { date, filter, sourceLabel } })}
        onMonthChange={handleMonthChange}
        scheduleFilter={filter}
        onFilterChange={handleFilterChange}
        filterOptions={filterOptions}
      />
    </View>
    </SplitScene>
  );
}
const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: Colors.brand.primary } });
