import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Colors from '@/constants/Colors';
import LevelBadge from './LevelBadge';

type Props = {
  profileImage?: string | null;
  nickname?: string | null;
  level?: string | number | null;
  count?: string | null; // 16장: 관리자 처리할 건수 (홈 툴바), 없으면 안 보임
  showLevel?: boolean; // false면 레벨 배지를 그리지 않음 (홈 툴바, 2026-11-08)
};

// Shared with the home toolbar: 40px frame, 35px photo, 16px level badge (the toolbar hides the badge).
export default function ProfileAvatar({ profileImage, nickname, level, count, showLevel = true }: Props) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  return (
    <View style={styles.frame}>
      {profileImage && failedImage !== profileImage ? (
        <Image source={{ uri: profileImage }} style={styles.image} onError={() => setFailedImage(profileImage)} />
      ) : (
        <View style={[styles.image, styles.placeholder]}>
          <Text style={styles.initial}>{nickname?.charAt(0) || '?'}</Text>
        </View>
      )}
      {showLevel ? <View style={styles.badge}><LevelBadge level={level} size={16} /></View> : null}
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
  placeholder: { backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.white },
  badge: { position: 'absolute', bottom: -3, right: -3, borderWidth: 1.5, borderColor: Colors.brand.primary, borderRadius: 10 },
  count: {
    position: 'absolute', top: -5, right: -7, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#E53935', borderWidth: 1.5, borderColor: Colors.brand.primary,
  },
  countText: { fontFamily: 'SUIT-Bold', fontSize: 10, color: Colors.brand.white },
});
