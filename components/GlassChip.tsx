import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { LiquidGlassView } from '@/utils/liquidGlass';

type Props = {
  active?: boolean;
  // Shown where Liquid Glass is unavailable (iOS < 26, Android, or a build without the native module).
  fallbackStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

// Segment / filter chip. The parent Pressable handles the tap.
// The selected chip gets a light tint so it stands out from the clear ones beside it.
export default function GlassChip({ active = false, fallbackStyle, children }: Props) {
  if (!LiquidGlassView) return <View style={fallbackStyle}>{children}</View>;
  return (
    <LiquidGlassView
      isInteractive
      glassEffectStyle={active ? 'regular' : 'clear'}
      tintColor={active ? 'rgba(255,255,255,0.22)' : undefined}
      colorScheme="dark"
      style={styles.chip}
    >
      {children}
    </LiquidGlassView>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
