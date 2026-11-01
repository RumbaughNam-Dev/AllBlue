import React, { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import Colors from '@/constants/Colors';

const ROW = 40;
const VISIBLE = 3;

type Props = { values: number[]; value: number; onChange: (value: number) => void; label: string };

// 위아래로 끌어서 고르는 숫자 휠 (9장 모집 인원 / 최대 인원). 가운데 줄이 고른 값.
export default function WheelPicker({ values, value, onChange, label }: Props) {
  const scroll = useRef<ScrollViewInstance>(null);
  const index = Math.max(0, values.indexOf(value));
  // 값이 바깥에서 바뀌면(예: 최대 인원보다 커진 모집 인원을 맞출 때) 그 자리로
  useEffect(() => { scroll.current?.scrollTo({ y: index * ROW, animated: true }); }, [index]);

  // Only a drag picks a value; the scroll that follows a value set from outside doesn't.
  const dragging = useRef(false);
  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!dragging.current) return;
    dragging.current = false;
    const next = values[Math.max(0, Math.min(values.length - 1, Math.round(e.nativeEvent.contentOffset.y / ROW)))];
    if (next !== value) onChange(next);
  };

  return (
    <View style={styles.column}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.wheel}>
        <View pointerEvents="none" style={styles.selection} />
        <ScrollView
          ref={scroll}
          showsVerticalScrollIndicator={false}
          snapToInterval={ROW}
          decelerationRate="fast"
          contentOffset={{ x: 0, y: index * ROW }}
          contentContainerStyle={{ paddingVertical: ROW * Math.floor(VISIBLE / 2) }}
          onScrollBeginDrag={() => { dragging.current = true; }}
          onMomentumScrollEnd={settle}
          onScrollEndDrag={e => { if (!e.nativeEvent.velocity?.y) settle(e); }}
          accessibilityLabel={`${label} ${value}명`}
          accessibilityRole="adjustable"
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={e => {
            const next = values[index + (e.nativeEvent.actionName === 'increment' ? 1 : -1)];
            if (next !== undefined) onChange(next);
          }}
        >
          {values.map(v => (
            <View key={v} style={styles.row}>
              <Text style={[styles.value, v === value && styles.valueSelected]}>{v}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  column: { flex: 1, alignItems: 'center', gap: 8 },
  label: { fontFamily: 'SUIT-SemiBold', fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  wheel: { height: ROW * VISIBLE, width: '100%', overflow: 'hidden' },
  selection: {
    position: 'absolute', left: 8, right: 8, top: ROW * Math.floor(VISIBLE / 2), height: ROW,
    borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.12)',
  },
  row: { height: ROW, alignItems: 'center', justifyContent: 'center' },
  value: { fontFamily: 'SUIT-Regular', fontSize: 18, color: 'rgba(255,255,255,0.35)' },
  valueSelected: { fontFamily: 'SUIT-Bold', fontSize: 22, color: Colors.brand.white },
});
