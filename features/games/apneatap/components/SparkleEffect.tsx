import React, {useEffect, useMemo} from 'react';
import {Animated, Dimensions, StyleSheet, View} from 'react-native';

const {width: SW, height: SH} = Dimensions.get('window');
const NUM_SPARKLES = 35;

interface Props {
  color?: string;
}

interface SparkleData {
  x: number;
  y: number;
  size: number;
  opacity: Animated.Value;
  translateX: Animated.Value;
  duration: number;
  delay: number;
}

export default function SparkleEffect({
  color = 'rgba(255, 255, 255, 0.9)',
}: Props) {
  const sparkles = useMemo<SparkleData[]>(
    () =>
      Array.from({length: NUM_SPARKLES}, () => ({
        x: Math.random() * SW,
        y: Math.random() * SH,
        size: 2 + Math.random() * 5,
        opacity: new Animated.Value(0),
        translateX: new Animated.Value(0),
        duration: 800 + Math.random() * 2500,
        delay: Math.random() * 3000,
      })),
    [],
  );

  useEffect(() => {
    sparkles.forEach(s => {
      Animated.sequence([
        Animated.delay(s.delay),
        Animated.loop(
          Animated.sequence([
            Animated.timing(s.opacity, {
              toValue: 0.5 + Math.random() * 0.5,
              duration: s.duration,
              useNativeDriver: true,
            }),
            Animated.timing(s.opacity, {
              toValue: 0,
              duration: s.duration * 0.7,
              useNativeDriver: true,
            }),
            Animated.delay(Math.random() * 800),
          ]),
        ),
      ]).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(s.translateX, {
            toValue: -6 + Math.random() * 12,
            duration: s.duration * 2,
            useNativeDriver: true,
          }),
          Animated.timing(s.translateX, {
            toValue: 0,
            duration: s.duration * 2,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    });
  }, [sparkles]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {sparkles.map((s, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: s.x,
            top: s.y,
            width: s.size,
            height: s.size,
            borderRadius: s.size / 2,
            backgroundColor: color,
            opacity: s.opacity,
            transform: [{translateX: s.translateX}],
            shadowColor: color,
            shadowOffset: {width: 0, height: 0},
            shadowOpacity: 0.8,
            shadowRadius: s.size * 2,
          }}
        />
      ))}
    </View>
  );
}
