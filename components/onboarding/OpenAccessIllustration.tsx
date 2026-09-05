import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import Colors from '@/constants/Colors';

const PERSON_COLORS = [
  Colors.brand.primary,
  Colors.brand.accent,
  '#7DD3E8',
  '#FF9800',
  '#22C55E',
  '#9C27B0',
];

const PERSON_ANGLES = [-90, -30, 30, 90, 150, 210];
const RADIUS = 80;

export default function OpenAccessIllustration() {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 1200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  const globeStyle = {
    opacity: progress.interpolate({ inputRange: [0, 0.3], outputRange: [0, 1], extrapolate: 'clamp' }),
    transform: [{ scale: progress.interpolate({ inputRange: [0, 0.4], outputRange: [0.6, 1], extrapolate: 'clamp' }) }],
  };

  const unlockStyle = {
    opacity: progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0, 0, 1], extrapolate: 'clamp' }),
    transform: [{ scale: progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0, 0, 1], extrapolate: 'clamp' }) }],
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.globe, globeStyle]}>
        <View style={styles.globeRing1} />
        <View style={styles.globeRing2} />
        <View style={styles.globeCenter} />
      </Animated.View>

      {PERSON_ANGLES.map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        const x = Math.cos(rad) * RADIUS;
        const y = Math.sin(rad) * RADIUS;
        const delay = 0.2 + i * 0.08;

        const personStyle = {
          opacity: progress.interpolate({ inputRange: [0, delay, delay + 0.3], outputRange: [0, 0, 1], extrapolate: 'clamp' }),
          transform: [
            { translateX: progress.interpolate({ inputRange: [0, delay, delay + 0.3], outputRange: [0, 0, x], extrapolate: 'clamp' }) },
            { translateY: progress.interpolate({ inputRange: [0, delay, delay + 0.3], outputRange: [0, 0, y], extrapolate: 'clamp' }) },
            { scale: progress.interpolate({ inputRange: [0, delay, delay + 0.3], outputRange: [0, 0, 1], extrapolate: 'clamp' }) },
          ],
        };

        return (
          <Animated.View key={i} style={[styles.personDot, personStyle]}>
            <View style={[styles.miniHead, { backgroundColor: PERSON_COLORS[i] }]} />
            <View style={[styles.miniBody, { backgroundColor: PERSON_COLORS[i], opacity: 0.6 }]} />
          </Animated.View>
        );
      })}

      <Animated.View style={[styles.unlockBadge, unlockStyle]}>
        <View style={styles.lockBody}>
          <View style={styles.lockShackle} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: 260, height: 220, alignItems: 'center', justifyContent: 'center' },
  globe: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.brand.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  globeRing1: { position: 'absolute', width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: Colors.brand.primary, opacity: 0.2 },
  globeRing2: { position: 'absolute', width: 50, height: 80, borderRadius: 25, borderWidth: 2, borderColor: Colors.brand.primary, opacity: 0.15 },
  globeCenter: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.brand.primary },
  personDot: { position: 'absolute', alignItems: 'center' },
  miniHead: { width: 20, height: 20, borderRadius: 10 },
  miniBody: { width: 24, height: 14, borderRadius: 7, marginTop: 2 },
  unlockBadge: { position: 'absolute', bottom: 20, right: 40 },
  lockBody: { width: 22, height: 16, borderRadius: 4, backgroundColor: Colors.brand.accent, alignItems: 'center' },
  lockShackle: {
    position: 'absolute', top: -10, right: -2, width: 14, height: 12,
    borderTopLeftRadius: 7, borderTopRightRadius: 7, borderWidth: 2.5,
    borderBottomWidth: 0, borderColor: Colors.brand.accent, transform: [{ rotate: '15deg' }],
  },
});
