import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Colors from '@/constants/Colors';
import LevelBadge from './LevelBadge';

type Props = {
  profileImage?: string | null;
  nickname?: string | null;
  level?: string | number | null;
};

// Shared with the home toolbar: 40px frame, 35px photo, 16px level badge.
export default function ProfileAvatar({ profileImage, nickname, level }: Props) {
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
      <View style={styles.badge}><LevelBadge level={level} size={16} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: 40, height: 40, flexShrink: 0, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 20, padding: 1 },
  image: { width: 35, height: 35, borderRadius: 17.5 },
  placeholder: { backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.white },
  badge: { position: 'absolute', bottom: -3, right: -3, borderWidth: 1.5, borderColor: Colors.brand.primary, borderRadius: 10 },
});
