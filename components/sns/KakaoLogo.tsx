import React from 'react';
import { View, StyleSheet } from 'react-native';

// color: 말풍선 색 (로그인 버튼은 노란 바탕에 갈색, 프로필 링크 칩은 카카오 노랑)
export default function KakaoLogo({ size = 20, color = '#3C1E1E' }: { size?: number; color?: string }) {
  const s = size;
  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      {/* Chat bubble body */}
      <View
        style={{
          width: s * 0.9,
          height: s * 0.7,
          borderRadius: s * 0.25,
          backgroundColor: color,
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
          borderTopColor: color,
          transform: [{ rotate: '-20deg' }],
        }}
      />
    </View>
  );
}
