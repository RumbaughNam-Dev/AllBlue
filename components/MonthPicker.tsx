import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, SectionList, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/Colors';
import Spinner from '@/components/Spinner';

const YEAR_RANGE_START = 2020;
const YEAR_RANGE_END = 2035;

const HEADER_HEIGHT = 48;
const ROW_HEIGHT = 64;
const YEAR_BLOCK_HEIGHT = HEADER_HEIGHT + ROW_HEIGHT * 4;

type Props = {
  currentYear: number;
  currentMonth: number;
  onSelect: (year: number, month: number) => void;
};

export default function MonthPicker({ currentYear, currentMonth, onSelect }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const cellWidth = width / 3;

  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();

  const sections = useMemo(() => {
    const arr = [];
    for (let y = YEAR_RANGE_START; y <= YEAR_RANGE_END; y++) {
      const rows: number[][] = [];
      for (let m = 0; m < 12; m += 3) {
        rows.push([m, m + 1, m + 2]);
      }
      arr.push({ title: `${y}년`, year: y, data: rows });
    }
    return arr;
  }, []);

  const yearIndex = currentYear - YEAR_RANGE_START;
  const monthRowIndex = Math.floor(currentMonth / 3);
  const selectedOffset = yearIndex * YEAR_BLOCK_HEIGHT + HEADER_HEIGHT + monthRowIndex * ROW_HEIGHT;
  const initialOffset = Math.max(0, selectedOffset - height / 3);

  const [ready, setReady] = React.useState(false);
  const listRef = React.useRef<SectionList>(null);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      const scrollView = (listRef.current as any)?.getScrollResponder?.();
      if (scrollView) {
        scrollView.scrollTo({ y: yearIndex * YEAR_BLOCK_HEIGHT, animated: false });
      }
      setTimeout(() => setReady(true), 50);
    }, 50);
    return () => clearTimeout(timer);
  }, [yearIndex]);

  return (
    <View style={{ flex: 1 }}>
      {!ready && (
        <View style={styles.loadingOverlay}>
          <Spinner />
        </View>
      )}
    <SectionList
      ref={listRef}
      sections={sections}
      stickySectionHeadersEnabled={true}
      keyExtractor={(item, index) => index.toString()}
      style={{ opacity: ready ? 1 : 0 }}
      renderSectionHeader={({ section }) => (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>{section.title}</Text>
        </View>
      )}
      renderItem={({ item: row, section }) => (
        <View style={styles.monthRow}>
          {row.map((m: number) => {
            const isSelected = section.year === currentYear && m === currentMonth;
            const isToday = section.year === todayYear && m === todayMonth;

            return (
              <Pressable
                key={m}
                style={({ pressed }) => [
                  styles.monthCell,
                  { width: cellWidth },
                  isSelected && styles.monthCellSelected,
                  pressed && { opacity: 0.6 },
                ]}
                onPress={() => onSelect(section.year, m)}
              >
                <Text style={[
                  styles.monthText,
                  isSelected && styles.monthTextSelected,
                  isToday && !isSelected && styles.monthTextToday,
                ]}>
                  {m + 1}월
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
      contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
      showsVerticalScrollIndicator={false}
    />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  sectionHeader: {
    height: HEADER_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.brand.primary,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  sectionHeaderText: {
    fontFamily: 'SUIT-Bold',
    fontSize: 22,
    color: Colors.brand.white,
  },
  monthRow: {
    flexDirection: 'row',
    height: ROW_HEIGHT,
    alignItems: 'center',
  },
  monthCell: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  monthCellSelected: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  monthText: {
    fontFamily: 'SUIT-SemiBold',
    fontSize: 17,
    color: 'rgba(255,255,255,0.6)',
  },
  monthTextSelected: {
    fontFamily: 'SUIT-Bold',
    color: Colors.brand.white,
  },
  monthTextToday: {
    color: '#00E5FF',
  },
});
