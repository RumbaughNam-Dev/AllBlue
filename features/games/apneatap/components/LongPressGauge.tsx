import React, {useEffect, useRef} from 'react';
import {Animated, StyleSheet, View} from 'react-native';
import Svg, {Circle} from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 120;
const STROKE_WIDTH = 4;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface Props {
  x: number;
  y: number;
  visible: boolean;
  duration: number; // ms to fill completely
}

export default function LongPressGauge({x, y, visible, duration}: Props) {
  const progress = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (visible) {
      progress.setValue(0);
      opacity.setValue(1);
      animRef.current = Animated.timing(progress, {
        toValue: 1,
        duration,
        useNativeDriver: false, // strokeDashoffset can't use native driver
      });
      animRef.current.start();
    } else {
      animRef.current?.stop();
      Animated.timing(opacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: false,
      }).start();
    }
  }, [visible, duration, progress, opacity]);

  const dashOffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [CIRCUMFERENCE, 0],
  });

  if (!visible && (opacity as any)._value === 0) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          left: x - SIZE / 2,
          top: y - SIZE / 2,
          opacity,
        },
      ]}
      pointerEvents="none">
      <Svg width={SIZE} height={SIZE}>
        {/* Background circle */}
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />
        {/* Progress circle */}
        <AnimatedCircle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke="#38BDF8"
          strokeWidth={STROKE_WIDTH}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${CIRCUMFERENCE}`}
          strokeDashoffset={dashOffset}
          rotation="-90"
          origin={`${SIZE / 2}, ${SIZE / 2}`}
        />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
  },
});
