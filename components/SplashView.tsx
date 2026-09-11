import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Image as RNImage } from 'react-native';
import Colors from '@/constants/Colors';

const ANIMATION_DURATION = 4400;

type Props = {
  onFinish?: () => void;
};

export default function SplashView({ onFinish }: Props) {
  const { width, height } = useWindowDimensions();
  const shortSide = Math.min(width, height);
  const videoSize = shortSide * 0.58;
  const hasCalledFinish = useRef(false);
  const [showStatic, setShowStatic] = useState(false);

  const callFinish = useCallback(() => {
    if (hasCalledFinish.current) return;
    hasCalledFinish.current = true;
    onFinish?.();
  }, [onFinish]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowStatic(true);
      setTimeout(callFinish, 1000);
    }, ANIMATION_DURATION);

    return () => clearTimeout(timer);
  }, [callFinish]);

  return (
    <View style={styles.container}>
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
