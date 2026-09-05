import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Animated, Easing, useWindowDimensions } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Image as RNImage } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/Colors';

const ANIMATION_DURATION = 4400;

type Props = {
  onFinish?: () => void;
};

export default function SplashView({ onFinish }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const shortSide = Math.min(width, height);
  const videoSize = shortSide * 0.58;
  const adFade = useRef(new Animated.Value(0)).current;
  const hasCalledFinish = useRef(false);
  const [showStatic, setShowStatic] = useState(false);

  const callFinish = useCallback(() => {
    if (hasCalledFinish.current) return;
    hasCalledFinish.current = true;
    onFinish?.();
  }, [onFinish]);

  useEffect(() => {
    const timer = setTimeout(() => {
      console.log('[스플래시] 애니메이션 종료, 정지 이미지 표시');
      setShowStatic(true);
      Animated.timing(adFade, {
        toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }).start(() => {
        setTimeout(callFinish, 1000);
      });
    }, ANIMATION_DURATION);

    return () => clearTimeout(timer);
  }, [callFinish]);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.centerArea}>
        <View style={{ width: videoSize, height: videoSize, overflow: 'hidden' }}>
          <ExpoImage
            source={require('@/assets/videos/splash.webp')}
            style={{ width: videoSize, height: videoSize }}
            contentFit="contain"
            autoplay={true}
          />
          {showStatic && (
            <RNImage
              source={require('@/assets/videos/splash-last.png')}
              style={{ position: 'absolute', top: 0, left: 0, width: videoSize, height: videoSize }}
              resizeMode="contain"
            />
          )}
        </View>
      </View>

      <Animated.View style={[styles.adSection, { opacity: adFade }]}>
        <RNImage
          source={require('@/assets/images/ad-placeholder.jpg')}
          style={styles.adImage}
          resizeMode="cover"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brand.primary,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  centerArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adSection: {
    width: '100%',
    paddingHorizontal: 24,
  },
  adImage: {
    width: '100%',
    height: 240,
    borderRadius: 12,
  },
});
