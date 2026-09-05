import React from 'react';
import { View, StyleSheet } from 'react-native';

export default function KakaoLogo({ size = 20 }: { size?: number }) {
  const s = size;
  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      {/* Chat bubble body */}
      <View
        style={{
          width: s * 0.9,
          height: s * 0.7,
          borderRadius: s * 0.25,
          backgroundColor: '#3C1E1E',
        }}
      />
      {/* Chat bubble tail */}
      <View
        style={{
          position: 'absolute',
          bottom: s * 0.05,
          left: s * 0.18,
          width: 0,
          height: 0,
          borderLeftWidth: s * 0.12,
          borderRightWidth: s * 0.12,
          borderTopWidth: s * 0.18,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderTopColor: '#3C1E1E',
          transform: [{ rotate: '-20deg' }],
        }}
      />
    </View>
  );
}
