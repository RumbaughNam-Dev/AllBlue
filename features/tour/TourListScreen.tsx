import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DeviceEventEmitter, StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/Colors';
import { useWindowedList } from '@/features/community/useWindowedList';
import { CenterMessage } from '@/features/community/ui';
import { api, type TourCard } from '@/services/api';
import { HeaderButton, TourHeader } from './FormParts';
import TourGridList from './TourGridList';
import { TourPhotoCard } from './TourCards';
import { TOURS_CHANGED, useTourRouter } from './nav';

const SIDE = 20;

const TITLES = { RECRUITING: '참여자 모집중', SEEKING_LEADER: '인솔자 모집중', CLOSED: '모집 마감' } as const;

// 12장 전체보기: 홈 줄의 상태만, 최근 등록 순 10개씩 · 최대 100개 · 큰 사진 카드 한 줄 2개 (펼친 화면 4개, 전체 화면)
export default function TourListScreen() {
  const { status: raw } = useLocalSearchParams<{ status?: string }>();
  const status = raw === 'SEEKING_LEADER' || raw === 'CLOSED' ? raw : 'RECRUITING';
  const router = useTourRouter();
  const expo = useRouter();
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const list = useWindowedList<TourCard>(cursor => api.getTours(status, cursor));
  const first = useRef(true);
  const reloadRef = useRef(list.reload); reloadRef.current = list.reload;
  useFocusEffect(useCallback(() => { void reloadRef.current(first.current ? 'first' : 'quiet'); first.current = false; }, [status]));
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(TOURS_CHANGED, () => { void reloadRef.current('quiet'); });
    return () => sub.remove();
  }, []);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      <TourHeader title={TITLES[status]} onBack={() => router.back()}
        right={<HeaderButton label="검색" onPress={() => expo.push('/tour-search')} />} />
      {list.state !== 'ready' ? <CenterMessage loading={list.state === 'loading'} message="투어를 불러오지 못했어요." onRetry={() => void list.reload()} /> : (
        <TourGridList list={list} width={width} side={SIDE} bottom={insets.bottom} empty="아직 투어가 없어요."
          renderCard={(tour, cardWidth) => (
            <TourPhotoCard tour={tour} width={cardWidth} onPress={() => router.push({ pathname: '/tour-detail', params: { id: String(tour.id) } })} />
          )} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.brand.primary },
});
