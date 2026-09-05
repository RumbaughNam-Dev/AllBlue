import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const LEVEL_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  '1': { label: '프', bg: '#F5F5F5', color: '#333333' },
  '2': { label: '1', bg: '#FFE500', color: '#333333' },
  '3': { label: '2', bg: '#33CC33', color: '#FFFFFF' },
  '4': { label: '3', bg: '#E53030', color: '#FFFFFF' },
  '5': { label: 'I', bg: '#3B92C5', color: '#FFFFFF' },
  'A': { label: 'A', bg: '#7B2FBE', color: '#FFFFFF' },
};

type Props = {
  level: number | string | null | undefined;
  size?: number;
};

export default function LevelBadge({ level, size = 22 }: Props) {
  if (level === null || level === undefined || level === 0) return null;

  const key = String(level);
  const config = LEVEL_CONFIG[key];
  if (!config) return null;

  const isItalic = key === '5' || key === 'A';
  const fontSize = isItalic ? size * 0.59 : size * 0.5;

  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size / 2, backgroundColor: config.bg }]}>
      <Text style={[
        styles.badgeText,
        { color: config.color, fontSize },
        isItalic && styles.badgeItalic,
      ]}>
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: 'SUIT-Bold',
  },
  badgeItalic: {
    fontFamily: 'SpaceMono',
    fontStyle: 'italic',
  },
});
