import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Image as RNImage } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/Colors';
import AdSlot from '@/components/AdSlot';
import { AD_IMAGES, AD_LINKS } from '@/constants/Ads';

const ANIMATION_DURATION = 4400;
const AD_MARGIN = 24;

type Props = {
  onFinish?: () => void;
};

export default function SplashView({ onFinish }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const shortSide = Math.min(width, height);
  const videoSize = shortSide * 0.58;
  // Leave room for the logo on short/wide screens; AdSlot shrinks the image to fit.
  const adMaxHeight = Math.max(0, height - insets.top - insets.bottom - videoSize - AD_MARGIN * 3);
  const adWidth = width - AD_MARGIN * 2;
  const adHeight = Math.min(adWidth * 3 / 4, adMaxHeight);
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
      <View style={styles.logoArea}>
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
      <AdSlot
        source={AD_IMAGES.splash}
        url={AD_LINKS.splash}
        style={[styles.ad, { width: adWidth, height: adHeight, marginBottom: AD_MARGIN + insets.bottom }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brand.primary,
  },
  logoArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ad: {
    alignSelf: 'center',
  },
});
