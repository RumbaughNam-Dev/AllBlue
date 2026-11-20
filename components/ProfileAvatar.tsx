import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Colors from '@/constants/Colors';
import LevelBadge from './LevelBadge';
import { useUserGrade } from '@/features/grade/store';
import { gradeColor } from '@/features/grade/grade';
import GradePill from '@/features/grade/GradePill';

type Props = {
  profileImage?: string | null;
  nickname?: string | null;
  level?: string | number | null;
  count?: string | null; // 16장: 관리자 처리할 건수 (홈 툴바), 없으면 안 보임
  showLevel?: boolean; // false면 자격증 레벨 배지를 그리지 않음 (홈 툴바, 2026-11-08)
  userId?: string | null; // 활동 등급: 테두리를 등급 색으로 + 오른쪽 위 'Lv n' (2026-11-20). 게스트 · 임시 회원은 비움
};

// Shared with the home toolbar: 40px frame, 35px photo, 16px level badge (the toolbar hides the badge).
// 자격증 레벨 배지는 오른쪽 아래, 활동 등급 레벨은 오른쪽 위 (2026-11-20 사용자)
export default function ProfileAvatar({ profileImage, nickname, level, count, showLevel = true, userId }: Props) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const grade = useUserGrade(userId);
  return (
    <View style={[styles.frame, grade && { borderColor: gradeColor(grade), borderWidth: 2 }]}>
      {profileImage && failedImage !== profileImage ? (
        <Image source={{ uri: profileImage }} style={[styles.image, grade && styles.imageInRing]} onError={() => setFailedImage(profileImage)} />
      ) : (
        <View style={[styles.image, grade && styles.imageInRing, styles.placeholder]}>
          <Text style={styles.initial}>{nickname?.charAt(0) || '?'}</Text>
        </View>
      )}
      {showLevel ? <View style={styles.badge}><LevelBadge level={level} size={16} /></View> : null}
      {grade ? <GradePill grade={grade} variant="short" size={8} style={styles.grade} /> : null}
      {count ? (
        <View style={styles.count} accessibilityLabel={`처리할 관리자 요청 ${count}건`}>
          <Text style={styles.countText}>{count}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: 40, height: 40, flexShrink: 0, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 20, padding: 1 },
  image: { width: 35, height: 35, borderRadius: 17.5 },
  imageInRing: { width: 34, height: 34, borderRadius: 17 },
  placeholder: { backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.white },
  badge: { position: 'absolute', bottom: -3, right: -3, borderWidth: 1.5, borderColor: Colors.brand.primary, borderRadius: 10 },
  grade: { position: 'absolute', top: -7, right: -12 },
  // 관리자 건수는 오른쪽 아래 (오른쪽 위는 활동 등급 레벨, 툴바엔 자격증 배지가 없음)
  count: {
    position: 'absolute', bottom: -5, right: -7, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#E53935', borderWidth: 1.5, borderColor: Colors.brand.primary,
  },
  countText: { fontFamily: 'SUIT-Bold', fontSize: 10, color: Colors.brand.white },
});
