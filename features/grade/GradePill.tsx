import React from 'react';
import { StyleSheet, Text, View, ViewStyle, StyleProp } from 'react-native';
import { Grade, gradeColor, gradeLabel, gradeTextColor } from './grade';

// 등급 · 레벨 알약: full = '프린이 Lv 12', short = 'Lv 12' (작은 프로필 사진 위)
export default function GradePill({ grade, variant = 'full', size = 11, style }: {
  grade: Grade; variant?: 'full' | 'short'; size?: number; style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.pill, { backgroundColor: gradeColor(grade), paddingHorizontal: size * 0.55, height: size + 7, borderRadius: (size + 7) / 2 }, style]}
      accessibilityLabel={`활동 등급 ${gradeLabel(grade)}`}>
      <Text style={[styles.text, { fontSize: size, color: gradeTextColor(grade) }]} numberOfLines={1}>
        {variant === 'full' ? gradeLabel(grade) : `Lv ${grade.level}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#144A84' },
  text: { fontFamily: 'SUIT-Bold', includeFontPadding: false },
});
