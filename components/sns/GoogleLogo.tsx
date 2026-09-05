import React from 'react';
import { View } from 'react-native';

export default function GoogleLogo({ size = 20 }: { size?: number }) {
  const s = size;
  const t = s * 0.13; // stroke thickness

  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      {/* Outer ring segments */}
      {/* Red - top */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          width: s,
          height: s / 2,
          borderTopLeftRadius: s / 2,
          borderTopRightRadius: s / 2,
          borderWidth: t,
          borderBottomWidth: 0,
          borderColor: '#EA4335',
        }}
      />
      {/* Yellow - bottom left */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: s / 2,
          height: s / 2,
          borderBottomLeftRadius: s / 2,
          borderWidth: t,
          borderTopWidth: 0,
          borderRightWidth: 0,
          borderColor: '#FBBC05',
        }}
      />
      {/* Green - bottom right */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: s / 2,
          height: s / 2,
          borderBottomRightRadius: s / 2,
          borderWidth: t,
          borderTopWidth: 0,
          borderLeftWidth: 0,
          borderColor: '#34A853',
        }}
      />
      {/* Blue - right bar (the horizontal line of G) */}
      <View
        style={{
          position: 'absolute',
          right: 0,
          top: s * 0.44,
          width: s * 0.45,
          height: t,
          backgroundColor: '#4285F4',
        }}
      />
      {/* Blue - right vertical */}
      <View
        style={{
          position: 'absolute',
          right: s * 0.45 - t,
          top: s * 0.44,
          width: t,
          height: s * 0.12,
          backgroundColor: '#4285F4',
        }}
      />
    </View>
  );
}
