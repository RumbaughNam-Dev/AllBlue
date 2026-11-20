import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useUserGrade } from './store';
import { gradeColor } from './grade';
import GradePill from './GradePill';

// 직접 그린 프로필 사진에 활동 등급을 덧그림: 바깥 테두리(등급 색) + 오른쪽 위 레벨.
// 자리를 바꾸지 않게 테두리는 사진 바깥으로 겹쳐 그림. size = 사진 지름
export default function GradeFrame({ userId, size, pill = 'short', children }: {
  userId?: string | null; size: number; pill?: 'short' | 'full' | 'none'; children: React.ReactNode;
}) {
  const grade = useUserGrade(userId);
  const ring = size >= 64 ? 3 : 2;
  const pillSize = size >= 64 ? 12 : size >= 40 ? 9 : 8;
  return (
    <View style={{ width: size, height: size }}>
      {children}
      {grade ? (
        <>
          <View pointerEvents="none" style={[styles.ring, {
            top: -ring - 1, left: -ring - 1, width: size + 2 * ring + 2, height: size + 2 * ring + 2,
            borderRadius: (size + 2 * ring + 2) / 2, borderWidth: ring, borderColor: gradeColor(grade),
          }]} />
          {pill !== 'none' && size >= 28 ? (
            <GradePill grade={grade} variant={pill} size={pillSize}
              style={[styles.pill, pill === 'full' ? { top: -8, right: -10 } : { top: -7, right: -12 }]} />
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { position: 'absolute' },
  pill: { position: 'absolute' },
});
