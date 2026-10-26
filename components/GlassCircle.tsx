import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { LiquidGlassView } from '@/utils/liquidGlass';

type Props = {
  size?: number;
  // Shown where Liquid Glass is unavailable (iOS < 26, Android, or a build without the native module).
  fallbackStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

// Round control (back, month arrows, toolbar icons). The parent Pressable handles the tap.
export default function GlassCircle({ size = 36, fallbackStyle, children }: Props) {
  if (!LiquidGlassView) return <View style={fallbackStyle}>{children}</View>;
  return (
    <LiquidGlassView
      isInteractive
      glassEffectStyle="regular"
      colorScheme="dark"
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}
    >
      {children}
    </LiquidGlassView>
  );
}
