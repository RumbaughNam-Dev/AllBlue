import React from 'react';
import { Text, View } from 'react-native';

export default function NaverLogo({ size = 20 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Text
        style={{
          fontSize: size * 0.75,
          fontWeight: '900',
          color: '#FFFFFF',
          letterSpacing: -1,
        }}
      >
        N
      </Text>
    </View>
  );
}
