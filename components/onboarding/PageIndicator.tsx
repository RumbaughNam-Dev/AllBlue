import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import Colors from '@/constants/Colors';

type Props = {
  totalPages: number;
  scrollX: Animated.Value;
  pageWidth: number;
};

function Dot({ index, scrollX, pageWidth }: { index: number; scrollX: Animated.Value; pageWidth: number }) {
  const inputRange = [
    (index - 1) * pageWidth,
    index * pageWidth,
    (index + 1) * pageWidth,
  ];

  const width = scrollX.interpolate({
    inputRange,
    outputRange: [8, 28, 8],
    extrapolate: 'clamp',
  });

  const backgroundColor = scrollX.interpolate({
    inputRange,
    outputRange: [
      'rgba(255,255,255,0.35)',
      'rgba(255,255,255,1)',
      'rgba(255,255,255,0.35)',
    ],
    extrapolate: 'clamp',
  });

  const scale = scrollX.interpolate({
    inputRange: [
      (index - 0.5) * pageWidth,
      index * pageWidth,
      (index + 0.5) * pageWidth,
    ],
    outputRange: [1, 1.15, 1],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          width,
          backgroundColor,
          transform: [{ scaleY: scale }],
        },
      ]}
    />
  );
}

export default function PageIndicator({ totalPages, scrollX, pageWidth }: Props) {
  return (
    <View style={styles.container}>
      {Array.from({ length: totalPages }).map((_, i) => (
        <Dot key={i} index={i} scrollX={scrollX} pageWidth={pageWidth} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { height: 8, borderRadius: 4 },
});
