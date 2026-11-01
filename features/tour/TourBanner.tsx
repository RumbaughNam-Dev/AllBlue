import React, { useEffect, useRef, useState } from 'react';
import { AppState, FlatList, Image, NativeScrollEvent, NativeSyntheticEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import type { TourBanner as Banner } from '@/services/api';
import Colors from '@/constants/Colors';

// Values mirror common_code TOUR_CONFIG BANNER_ROLL_SECONDS.
const ROLL_MS = 3000;

type Props = { banners: Banner[]; width: number; height: number; onPress: (banner: Banner) => void };

// 홈 맨 위 광고: 넘겨 보거나 3초마다 다음 장으로 (끝에서 처음으로). 손대는 동안·앱이 뒤에 있을 땐 멈춤.
export default function TourBanner({ banners, width, height, onPress }: Props) {
  const list = useRef<FlatList<Banner>>(null);
  const [index, setIndex] = useState(0);
  const [touching, setTouching] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const count = banners.length;

  useEffect(() => {
    const listener = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => listener.remove();
  }, []);

  // A refreshed (reshuffled, maybe shorter) list starts from the first banner.
  const ids = banners.map(banner => banner.id).join(',');
  useEffect(() => {
    setIndex(0);
    list.current?.scrollToOffset({ offset: 0, animated: false });
  }, [ids]);

  useEffect(() => {
    if (count < 2 || touching || !foreground) return;
    const timer = setTimeout(() => {
      const next = (index + 1) % count;
      list.current?.scrollToOffset({ offset: next * width, animated: true });
      setIndex(next);
    }, ROLL_MS);
    return () => clearTimeout(timer);
  }, [index, count, touching, foreground, width]);

  const onSettled = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setTouching(false);
    setIndex(Math.max(0, Math.min(count - 1, Math.round(e.nativeEvent.contentOffset.x / width))));
  };

  return (
    <View style={[styles.frame, { width, height }]}>
      <FlatList
        ref={list}
        data={banners}
        keyExtractor={banner => String(banner.id)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onScrollBeginDrag={() => setTouching(true)}
        onMomentumScrollEnd={onSettled}
        renderItem={({ item }) => (
          <Pressable onPress={() => onPress(item)} style={({ pressed }) => pressed && { opacity: 0.85 }}>
            <Image source={{ uri: item.imageUrl }} style={{ width, height }} resizeMode="cover" />
          </Pressable>
        )}
      />
      <View pointerEvents="none" style={styles.ad}><Text style={styles.adText}>AD</Text></View>
      {count > 1 && (
        <View pointerEvents="none" style={styles.counter}>
          <Text style={styles.counterText}>{index + 1} / {count}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  ad: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  adText: {
    fontFamily: 'SUIT-Bold',
    fontSize: 10,
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.9)',
  },
  counter: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  counterText: {
    fontFamily: 'SUIT-SemiBold',
    fontSize: 11,
    color: Colors.brand.white,
  },
});
