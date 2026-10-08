import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Colors from '@/constants/Colors';
import Calendar from '@/components/Calendar';
import { useCalendarSchedules } from '@/hooks/useCalendarSchedules';

export default function TabA() {
  const router = useRouter();
  const { events, filter, filterOptions, error, retry, handleMonthChange, handleFilterChange } = useCalendarSchedules();
  return (
    <View style={styles.container}>
      {error && (
        <Pressable onPress={retry} style={{ padding: 12 }}>
          <Text style={{ color: 'white', textAlign: 'center' }}>일정을 불러오지 못했습니다. 눌러서 다시 시도해주세요.</Text>
        </Pressable>
      )}
      <Calendar
        events={events}
        onDatePress={(date) => router.push({ pathname: '/schedule-daily', params: {
          date, filter,
          sourceLabel: filter.startsWith('group_')
            ? `${filterOptions.find((option) => option.key === filter)?.label ?? '그룹'} 그룹 일정`
            : filterOptions.find((option) => option.key === filter)?.label ?? '내 일정',
        } })}
        onMonthChange={handleMonthChange}
        scheduleFilter={filter}
        onFilterChange={handleFilterChange}
        filterOptions={filterOptions}
      />
    </View>
  );
}
const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: Colors.brand.primary } });
