import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import type { TourCard } from '@/services/api';
import { TOUR_STATUS, formatRecruitment, formatTourPeriod } from './ui';

export const TOUR_CARD_WIDTH = 148;

export function StatusBadge({ status }: { status: TourCard['status'] }) {
  const meta = TOUR_STATUS[status];
  if (!meta) return null;
  return (
    <View style={[styles.badge, { backgroundColor: meta.color }]}>
      <Text style={[styles.badgeText, { color: meta.text }]}>{meta.label}</Text>
    </View>
  );
}

function Thumbnail({ uri, style }: { uri: string | null; style: object }) {
  if (uri) return <Image source={{ uri }} style={style} resizeMode="cover" />;
  return (
    <View style={[style, styles.noImage]}>
      <Ionicons name="airplane-outline" size={22} color="rgba(255,255,255,0.3)" />
    </View>
  );
}

// 카드형: 이미지 위 상태 배지, 투어명 · 나라 · 기간 (· 인솔 강사) · 모집현황
export function TourCardItem({ tour, width = TOUR_CARD_WIDTH, showInstructor, onPress }: {
  tour: TourCard; width?: number; showInstructor?: boolean; onPress: (tour: TourCard) => void;
}) {
  return (
    <Pressable onPress={() => onPress(tour)} style={({ pressed }) => [styles.card, { width }, pressed && { opacity: 0.7 }]}>
      <View>
        <Thumbnail uri={tour.imageUrl} style={{ width, height: width * 3 / 4 }} />
        <View style={styles.cardBadge}><StatusBadge status={tour.status} /></View>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.title} numberOfLines={1}>{tour.title}</Text>
        {/* Narrow card: country and dates on their own lines so neither gets cut off */}
        <Text style={styles.meta} numberOfLines={1}>{tour.countryName}</Text>
        <Text style={styles.meta} numberOfLines={1}>{formatTourPeriod(tour.startDate, tour.endDate)}</Text>
        {showInstructor && <Text style={styles.meta} numberOfLines={1}>by {tour.instructor.nickname}</Text>}
        <Text style={styles.recruit}>{formatRecruitment(tour.recruitedCount, tour.capacity)}</Text>
      </View>
    </Pressable>
  );
}

// 목록형: 썸네일 · 투어명 · 나라 · 기간 · 인솔 강사, 오른쪽에 상태 배지와 모집현황
export function TourRow({ tour, onPress }: { tour: TourCard; onPress: (tour: TourCard) => void }) {
  return (
    <Pressable onPress={() => onPress(tour)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
      <Thumbnail uri={tour.imageUrl} style={styles.rowImage} />
      <View style={styles.rowBody}>
        <Text style={styles.title} numberOfLines={1}>{tour.title}</Text>
        <Text style={styles.meta} numberOfLines={1}>{tour.countryName} · {formatTourPeriod(tour.startDate, tour.endDate)}</Text>
        <Text style={styles.meta} numberOfLines={1}>by {tour.instructor.nickname}</Text>
      </View>
      <View style={styles.rowSide}>
        <StatusBadge status={tour.status} />
        <Text style={styles.recruit}>{formatRecruitment(tour.recruitedCount, tour.capacity)}</Text>
      </View>
    </Pressable>
  );
}

// 7장: 홈 툴바와 같은 'allblue' 로고를 크게 + 안내 문구
export function TourEmpty({ message }: { message: string }) {
  return (
    <View style={styles.emptyArea}>
      <Text style={styles.logo}>all<Text style={styles.logoAccent}>b</Text>lue</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  cardBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  cardBody: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  rowImage: {
    width: 64,
    height: 64,
    borderRadius: 8,
  },
  rowBody: {
    flex: 1,
    gap: 3,
  },
  rowSide: {
    alignItems: 'flex-end',
    gap: 8,
  },
  noImage: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  title: {
    fontFamily: 'SUIT-Bold',
    fontSize: 14,
    color: Colors.brand.white,
  },
  meta: {
    fontFamily: 'SUIT-Regular',
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
  },
  recruit: {
    fontFamily: 'SUIT-SemiBold',
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: {
    fontFamily: 'SUIT-Bold',
    fontSize: 11,
  },
  emptyArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 60,
  },
  // Same face and spacing as the toolbar logo (SUIT-Regular, letterSpacing 4 at 20pt), scaled up.
  logo: {
    fontFamily: 'SUIT-Regular',
    fontSize: 34,
    letterSpacing: 34 * (4 / 20),
    color: Colors.brand.white,
  },
  logoAccent: {
    color: '#00E5FF',
  },
  emptyMessage: {
    fontFamily: 'SUIT-SemiBold',
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
  },
});
