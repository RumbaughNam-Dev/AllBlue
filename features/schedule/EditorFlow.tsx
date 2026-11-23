import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Colors from '@/constants/Colors';

// 다이빙 만들기 · 수정 (2026-11-23): 한 항목씩 입력하는 흐름.
// 지금 입력할 카드는 맨 위에서 내려오며(높이가 0에서 펼쳐져 아래 카드들을 밀어냄),
// 입력을 마친 카드는 아래로 밀려 살짝 어둡고 작아짐(뒤로 들어가는 느낌). 끝난 카드를 누르면 다시 고칠 수 있음.

export function StepBadge({ index, total }: { index: number; total: number }) {
  return (
    <View style={styles.badge} accessibilityLabel={`${total}개 중 ${index}번째`}>
      <Text style={styles.badgeText}>{index} / {total}</Text>
    </View>
  );
}

// 위에서 내려오는 카드: 안쪽 높이를 잰 뒤 바깥 높이를 0 → 높이로 펼치고, 안쪽은 위에서 내려오며 나타남.
// 다 펼친 뒤에는 높이를 풀어 두어 내용이 바뀌어도(입력칸 추가, 검색 결과 등) 자연스럽게 늘어남
export function EnteringCard({ children, style }: { children: React.ReactNode; style?: object }) {
  const progress = useRef(new Animated.Value(0)).current;
  const [height, setHeight] = useState(0);
  const [settled, setSettled] = useState(false);
  const started = useRef(false);

  const onLayout = (e: LayoutChangeEvent) => {
    if (settled) return;
    const h = e.nativeEvent.layout.height;
    if (h > 0 && h !== height) setHeight(h);
  };
  useEffect(() => {
    if (!height || started.current) return;
    started.current = true;
    Animated.timing(progress, { toValue: 1, duration: 340, easing: Easing.out(Easing.cubic), useNativeDriver: false })
      .start(({ finished }) => { if (finished) setSettled(true); });
  }, [height, progress]);

  return (
    <Animated.View style={settled ? null : { height: progress.interpolate({ inputRange: [0, 1], outputRange: [0, height || 0] }), overflow: 'hidden' }}>
      <Animated.View onLayout={onLayout} style={[style, settled ? null : {
        opacity: progress,
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-28, 0] }) }],
      }]}>
        {children}
      </Animated.View>
    </Animated.View>
  );
}

// 입력을 마친 카드: 처음 보일 때 밝은 상태에서 어둡고 작게 물러남
export function DoneCard({ label, value, index, total, onPress }: {
  label: string; value: string; index: number; total: number; onPress: () => void;
}) {
  const recede = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(recede, { toValue: 1, duration: 360, delay: 60, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [recede]);
  return (
    <Animated.View style={{
      opacity: recede.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] }),
      transform: [{ scale: recede.interpolate({ inputRange: [0, 1], outputRange: [1, 0.95] }) }],
    }}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label} ${value}, 눌러서 고치기`}
        style={({ pressed }) => [styles.doneCard, pressed && { opacity: 0.7 }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.doneLabel}>{label}</Text>
          <Text style={styles.doneValue} numberOfLines={2}>{value}</Text>
        </View>
        <StepBadge index={index} total={total} />
      </Pressable>
    </Animated.View>
  );
}

export const flowStyles = StyleSheet.create({
  // 테두리 · 바탕 상자 없이 내용만 (2026-11-23 요청)
  card: { paddingTop: 8, paddingBottom: 20 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  cardTitle: { fontFamily: 'SUIT-Bold', fontSize: 17, color: Colors.brand.white },
  hint: { fontFamily: 'SUIT-Regular', fontSize: 12, lineHeight: 18, color: 'rgba(255,255,255,0.45)', marginTop: 8 },
});

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  badgeText: { fontFamily: 'SUIT-SemiBold', fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  doneCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.15)',
  },
  doneLabel: { fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 2 },
  doneValue: { fontFamily: 'SUIT-SemiBold', fontSize: 15, color: Colors.brand.white },
});
