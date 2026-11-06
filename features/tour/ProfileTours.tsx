import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Colors from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { api, type TourCard } from '@/services/api';
import { StatusBadge, TourGrid, TourPhotoCard, useGridWidth } from './TourCards';
import { CYAN } from './ui';
import { useTourRouter } from './nav';

// 14장 강사 프로필 '진행한 투어 n': 다이빙 기록 아래, 인솔자로 모집 마감된 투어(제안 승낙 포함)를 최근 출발일 순으로.
// 한 줄에 2개 (펼친 화면 4개) · 누르면 투어 상세 · 10개씩 '더 보기'. 없으면 칸째 숨김.
// 투어 탭과 같이 admin에게만 보임 (탭을 모두에게 열 때 app/(tabs)/_layout.tsx의 showTour와 함께 풀 것)
export default function ProfileTours({ userId }: { userId: string }) {
  const { user } = useAuth();
  const router = useTourRouter();
  const grid = useGridWidth();
  const visible = user?.level === 'A';
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<TourCard[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let alive = true;
    setTotal(0); setItems([]); setHasMore(false);
    if (!visible || !userId) return;
    api.getLedTours(userId)
      .then(page => { if (alive) { setTotal(page.total); setItems(page.items); setHasMore(page.hasMore); } })
      .catch(() => { /* 못 불러오면 칸을 숨긴 채로 */ });
    return () => { alive = false; };
  }, [userId, visible]);

  const more = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await api.getLedTours(userId, items.length);
      setItems(prev => [...prev, ...page.items.filter(t => !prev.some(p => p.id === t.id))]);
      setHasMore(page.hasMore); setTotal(page.total);
    } catch { /* 다시 누르면 재시도 */ } finally {
      setLoadingMore(false);
    }
  };

  if (!visible || !items.length) return null;
  return (
    <View>
      <View style={styles.divider} />
      <Text style={styles.title}>진행한 투어 <Text style={styles.count}>{total}</Text></Text>
      <View onLayout={grid.onLayout}>
        <TourGrid items={items} cardWidth={grid.cardWidth} keyOf={t => t.id} renderItem={tour => (
          <TourPhotoCard tour={tour} width={grid.cardWidth} badge={<StatusBadge status={tour.status} small />} lines={{ lead: '' }}
            onPress={() => router.push({ pathname: '/tour-detail', params: { id: String(tour.id) } })} />
        )} />
      </View>
      {hasMore ? (
        <Pressable accessibilityRole="button" onPress={() => void more()} disabled={loadingMore} style={({ pressed }) => [styles.more, pressed && { opacity: 0.7 }]}>
          {loadingMore ? <ActivityIndicator color="rgba(255,255,255,0.7)" /> : <Text style={styles.moreText}>진행한 투어 더 보기</Text>}
        </Pressable>
      ) : null}
      <View style={styles.bottom} />
    </View>
  );
}

const styles = StyleSheet.create({
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 16 },
  title: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.white, marginBottom: 12 },
  count: { color: CYAN },
  more: { marginTop: 12, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  moreText: { fontFamily: 'SUIT-SemiBold', fontSize: 14, color: Colors.brand.white },
  // 마지막 줄 아래 여백 (14장: 끝까지 보이게)
  bottom: { height: 24 },
});
