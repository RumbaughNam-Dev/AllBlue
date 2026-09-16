import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Colors from '@/constants/Colors';
import { api, Schedule } from '@/services/api';
import Spinner from '@/components/Spinner';
import LevelBadge from '@/components/LevelBadge';

export default function ScheduleDailyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { date } = useLocalSearchParams<{ date: string }>();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  const dateObj = date ? new Date(date + 'T00:00:00') : new Date();
  const month = dateObj.getMonth() + 1;
  const day = dateObj.getDate();

  useFocusEffect(
    useCallback(() => {
      if (!date) return;
      setLoading(true);
      api.getDailySchedules(date)
        .then((res) => setSchedules(res.schedules ?? []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [date])
  );

  const formatTime = (h: number, m: number) => {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  // 일정 있는 시간 슬롯만 생성
  const buildTimelineSlots = () => {
    const slotMap = new Map<string, Schedule[]>();

    schedules.forEach((s) => {
      const key = formatTime(s.startHour, s.startMinute);
      if (!slotMap.has(key)) {
        slotMap.set(key, []);
      }
      slotMap.get(key)!.push(s);
    });

    return Array.from(slotMap.entries()).sort(([a], [b]) => a.localeCompare(b));
  };

  const timelineSlots = buildTimelineSlots();

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}>
          <View style={styles.backCircle}>
            <Text style={styles.backArrow}>{'<'}</Text>
          </View>
        </Pressable>
        <Text style={styles.headerTitle}>{month}월 {day}일</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.loadingArea}><Spinner /></View>
      ) : schedules.length === 0 ? (
        <View style={styles.emptyArea}>
          <Text style={styles.emptyMessage}>예정된 일정이 없습니다.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {timelineSlots.map(([time, items], slotIndex) => (
            <View key={time}>
              {/* 첫 슬롯 위쪽 작대기 */}
              {slotIndex === 0 && (
                <View style={styles.leadingLine}>
                  <View style={styles.timeLabelWrap} />
                  <View style={styles.lineColumn}>
                    <View style={styles.lineLeading} />
                  </View>
                </View>
              )}

              {/* 시간 + dot+선 + 카드 */}
              <View style={styles.timelineItem}>
                <View style={styles.timeLabelWrap}>
                  <Text style={styles.timeText}>{time}</Text>
                </View>

                <View style={styles.lineColumn}>
                  <View style={styles.dotActive} />
                  <View style={[styles.lineBottom, slotIndex === timelineSlots.length - 1 && styles.lineTrailing]} />
                </View>

                <View style={styles.timelineContent}>
                  {items.map((item) => (
                    <Pressable
                      key={item.id}
                      style={({ pressed }) => [styles.scheduleCard, pressed && { opacity: 0.7 }]}
                      onPress={() => router.push({ pathname: '/schedule-detail', params: { id: String(item.id) } })}
                    >
                      <Text style={styles.scheduleTitle}>{item.title}</Text>
                      <Text style={styles.scheduleDetail}>• 장소 : {item.poolName || '-'}</Text>
                      <Text style={styles.scheduleDetail}>• 분류 : {item.categoryName}</Text>
                      <Text style={styles.scheduleDetail}>• {item.categoryCode === 'TRAINING' || item.categoryCode === 'FUN_DIVE' ? '참석자' : '교육생'} : {item.participantCount}명</Text>
                      {(item.participants ?? []).length > 0 ? (
                        <View style={styles.participantList}>
                          {item.participants!.map((p, i) => (
                            <View key={i} style={styles.participantItem}>
                              <Text style={styles.scheduleParticipants}>
                                {'  - '}{p.nickname}{p.name ? ` (${p.name})` : ''}{' '}
                              </Text>
                              <LevelBadge level={p.level} size={18} />
                            </View>
                          ))}
                        </View>
                      ) : item.participantNames.length > 0 ? (
                        <Text style={styles.scheduleParticipants}>  - {item.participantNames.join(', ')}</Text>
                      ) : null}
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Add Button */}
      <View style={styles.bottomArea}>
        <Pressable
          style={({ pressed }) => [styles.addButton, pressed && { opacity: 0.85 }]}
          onPress={() => router.push({ pathname: '/schedule-add', params: { date: date ?? '' } })}
        >
          <Text style={styles.addButtonText}>다이빙 만들기</Text>
        </Pressable>
      </View>
    </View>
  );
}

const CARD_HEIGHT = 110;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brand.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
    paddingHorizontal: 20,
  },
  backButton: {
    width: 36,
    height: 36,
  },
  backCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontFamily: 'SUIT-Bold',
    fontSize: 16,
    color: Colors.brand.white,
    marginRight: 1,
  },
  headerTitle: {
    fontFamily: 'SUIT-Bold',
    fontSize: 22,
    color: Colors.brand.white,
  },
  emptyArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 24,
    marginVertical: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    borderStyle: 'dashed',
  },
  emptyMessage: {
    fontFamily: 'SUIT-Regular',
    fontSize: 15,
    color: 'rgba(255,255,255,0.35)',
  },
  loadingArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
  },
  leadingLine: {
    flexDirection: 'row',
  },
  lineLeading: {
    width: 2,
    height: CARD_HEIGHT / 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  lineBottom: {
    width: 2,
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  lineTrailing: {
    flex: 0,
    height: CARD_HEIGHT * 5 / 3,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  timeLabelWrap: {
    minWidth: 50,
    alignItems: 'flex-end',
    paddingRight: 10,
  },
  timeText: {
    fontFamily: 'SUIT-SemiBold',
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    flexShrink: 0,
    marginTop: -3,
  },
  lineColumn: {
    width: 20,
    alignItems: 'center',
  },
  dotActive: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: Colors.brand.white,
    backgroundColor: Colors.brand.primary,
  },
  timelineContent: {
    flex: 1,
    paddingLeft: 12,
    paddingTop: 0,
  },
  scheduleCard: {
    marginBottom: 16,
    minHeight: CARD_HEIGHT,
    marginTop: -3,
  },
  scheduleTitle: {
    fontFamily: 'SUIT-Bold',
    fontSize: 16,
    color: Colors.brand.white,
    marginBottom: 8,
  },
  scheduleDetail: {
    fontFamily: 'SUIT-Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 22,
  },
  participantList: {
    marginTop: 2,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scheduleParticipants: {
    fontFamily: 'SUIT-Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 22,
  },
  bottomArea: {
    paddingHorizontal: 24,
    paddingVertical: 12,
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
