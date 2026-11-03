import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Colors from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import type { ProfileTour } from '@/services/api';
import { StatusBadge } from './TourCards';
import { formatRecruitment, formatTourPeriod } from './ui';

// 13장 '진행한 투어 n': 다이빙 기록 아래, '투어 완료'만 최근 출발일 순. 눌러도 이동 없음.
// 투어 탭과 같이 admin에게만 보임 (탭을 모두에게 열 때 함께 풀 것)
export default function ProfileTours({ tours }: { tours: ProfileTour[] }) {
  const { user } = useAuth();
  if (user?.level !== 'A' || !tours.length) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.title}>진행한 투어 <Text style={styles.count}>{tours.length}</Text></Text>
      {tours.map(tour => (
        <View key={tour.id} style={styles.row} accessible accessibilityLabel={`${tour.title}, ${tour.countryName}, ${formatTourPeriod(tour.startDate, tour.endDate)}, 투어 완료, ${formatRecruitment(tour.recruitedCount, tour.capacity)}`}>
          <View style={styles.body}>
            <Text style={styles.name} numberOfLines={1}>{tour.title}</Text>
            <Text style={styles.meta} numberOfLines={1}>{tour.countryName} · {formatTourPeriod(tour.startDate, tour.endDate)}</Text>
          </View>
          <View style={styles.side}>
            <StatusBadge status="COMPLETED" />
            <Text style={styles.recruit}>{formatRecruitment(tour.recruitedCount, tour.capacity)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8, paddingBottom: 24 },
  title: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.white, marginBottom: 4 },
  count: { color: '#00E5FF' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)',
  },
  body: { flex: 1, gap: 4 },
  name: { fontFamily: 'SUIT-SemiBold', fontSize: 15, color: Colors.brand.white },
  meta: { fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  side: { alignItems: 'flex-end', gap: 6 },
  recruit: { fontFamily: 'SUIT-SemiBold', fontSize: 12, color: '#00E5FF' },
});
