import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassCircle from '@/components/GlassCircle';
import { LiquidGlassView } from '@/utils/liquidGlass';
import { openQuests, useDailyLeft } from './store';

// 홈 위쪽 종 아이콘 왼쪽 퀘스트 아이콘 (트로피). 오늘 남은 일간 퀘스트가 있으면 빨간 점
export default function QuestButton() {
  const left = useDailyLeft();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={left ? '퀘스트, 오늘 남은 퀘스트 있음' : '퀘스트'} onPress={openQuests}
      style={({ pressed }) => [styles.button, pressed && { opacity: 0.6 }]}>
      <GlassCircle size={38} fallbackStyle={styles.icon}>
        <Ionicons name="trophy-outline" size={LiquidGlassView ? 20 : 23} color="white" />
      </GlassCircle>
      {left ? <View style={styles.dot} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 5, right: 5, width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#EF4444', borderWidth: 1.5, borderColor: '#144A84' },
});
