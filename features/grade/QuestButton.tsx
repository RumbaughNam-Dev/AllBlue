import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
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
        <QuestGlyph size={LiquidGlassView ? 19 : 22} />
      </GlassCircle>
      {left ? <View style={styles.dot} /> : null}
    </Pressable>
  );
}

// 옆 아이콘(종 · 게임)과 같은 굵기의 선으로 그린 'Q': 동그라미 + 오른쪽 아래 꼬리
function QuestGlyph({ size }: { size: number }) {
  const stroke = Math.max(1.8, size * 0.09);
  const ring = size * 0.82;
  return (
    <View style={{ width: size, height: size }}>
      <View style={{
        position: 'absolute', left: (size - ring) / 2, top: (size - ring) / 2 - size * 0.03, width: ring, height: ring,
        borderRadius: ring / 2, borderWidth: stroke, borderColor: 'white',
      }} />
      <View style={{
        position: 'absolute', width: size * 0.36, height: stroke, borderRadius: stroke / 2, backgroundColor: 'white',
        left: size * 0.5, top: size * 0.7, transform: [{ rotate: '45deg' }], // 꼬리가 동그라미를 가로지르게 (돋보기처럼 안 보이게)
      }} />
    </View>
  );
}

const styles = StyleSheet.create({
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 5, right: 5, width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#EF4444', borderWidth: 1.5, borderColor: '#144A84' },
});
