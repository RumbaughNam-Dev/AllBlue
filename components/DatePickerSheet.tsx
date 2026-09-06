import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated, Easing, useWindowDimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/Colors';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

type Props = {
  visible: boolean;
  onClose: () => void;
  selectedDate: string; // YYYY-MM-DD
  onSelect: (date: string) => void;
};

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function DatePickerSheet({ visible, onClose, selectedDate, onSelect }: Props) {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;
  const [mounted, setMounted] = useState(false);

  const sel = selectedDate ? new Date(selectedDate + 'T00:00:00') : new Date();
  const [viewYear, setViewYear] = useState(sel.getFullYear());
  const [viewMonth, setViewMonth] = useState(sel.getMonth());

  useEffect(() => {
    if (visible) {
      const d = selectedDate ? new Date(selectedDate + 'T00:00:00') : new Date();
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
      setMounted(true);
      Animated.parallel([
        Animated.timing(backdropAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: screenHeight, duration: 250, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear(viewYear - 1);
      setViewMonth(11);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear(viewYear + 1);
      setViewMonth(0);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleDayPress = (day: number) => {
    const date = formatDate(viewYear, viewMonth, day);
    onSelect(date);
    onClose();
  };

  if (!mounted) return null;

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth);
  const today = new Date();
  const todayStr = formatDate(today.getFullYear(), today.getMonth(), today.getDate());

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  // 마지막 주 패딩
  const lastWeek = weeks[weeks.length - 1];
  while (lastWeek.length < 7) lastWeek.push(null);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        </Pressable>
      </Animated.View>

      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }], paddingBottom: insets.bottom + 16 }]}>
        <BlurView intensity={80} tint="dark" style={styles.blurWrap}>
          {/* 헤더 */}
          <View style={styles.header}>
            <Pressable onPress={goToPrevMonth} style={styles.navButton}>
              <Text style={styles.navText}>{'<'}</Text>
            </Pressable>
            <Text style={styles.monthTitle}>{viewYear}년 {viewMonth + 1}월</Text>
            <Pressable onPress={goToNextMonth} style={styles.navButton}>
              <Text style={styles.navText}>{'>'}</Text>
            </Pressable>
          </View>

          {/* 요일 */}
          <View style={styles.weekRow}>
            {WEEKDAYS.map((w, i) => (
              <View key={i} style={styles.weekCell}>
                <Text style={[styles.weekText, i === 0 && styles.sundayText]}>{w}</Text>
              </View>
            ))}
          </View>

          {/* 날짜 */}
          {weeks.map((week, wi) => (
            <View key={wi} style={styles.weekRow}>
              {week.map((day, di) => {
                if (day === null) return <View key={di} style={styles.dayCell} />;
                const dateStr = formatDate(viewYear, viewMonth, day);
                const isSelected = dateStr === selectedDate;
                const isToday = dateStr === todayStr;
                const isSunday = di === 0;

                return (
                  <Pressable key={di} style={styles.dayCell} onPress={() => handleDayPress(day)}>
                    <View style={[styles.dayInner, isSelected && styles.daySelected, isToday && !isSelected && styles.dayToday]}>
                      <Text style={[
                        styles.dayText,
                        isSunday && styles.sundayText,
                        isSelected && styles.daySelectedText,
                      ]}>
                        {day}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </BlurView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
  },
  blurWrap: {
    marginHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
    padding: 16,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 16,
  },
  navButton: {
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
  },
  navText: {
    fontFamily: 'SUIT-Bold', fontSize: 18, color: Colors.brand.white,
  },
  monthTitle: {
    fontFamily: 'SUIT-Bold', fontSize: 17, color: Colors.brand.white,
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekCell: {
    flex: 1, alignItems: 'center', paddingVertical: 6,
  },
  weekText: {
    fontFamily: 'SUIT-SemiBold', fontSize: 12, color: 'rgba(255,255,255,0.4)',
  },
  sundayText: {
    color: 'rgba(255,100,100,0.6)',
  },
  dayCell: {
    flex: 1, alignItems: 'center', paddingVertical: 4,
  },
  dayInner: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  daySelected: {
    backgroundColor: Colors.brand.white,
  },
  dayToday: {
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)',
  },
  dayText: {
    fontFamily: 'SUIT-Regular', fontSize: 15, color: Colors.brand.white,
  },
  daySelectedText: {
    color: Colors.brand.primary, fontFamily: 'SUIT-Bold',
  },
});
