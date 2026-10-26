import React from 'react';
import { Pressable, Text, StyleSheet, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { LiquidGlassView as GlassView } from '@/utils/liquidGlass';

type Props = {
  label: string;
  onPress: () => void;
  // Used where Liquid Glass is unavailable (iOS < 26, Android, or a build without the native module).
  fallbackStyle: StyleProp<ViewStyle>;
  fallbackPressedStyle?: StyleProp<ViewStyle>;
  fallbackTextStyle: StyleProp<TextStyle>;
};

export default function FloatingActionButton({ label, onPress, fallbackStyle, fallbackPressedStyle, fallbackTextStyle }: Props) {
  if (!GlassView) {
    return (
      <Pressable style={({ pressed }) => [fallbackStyle, pressed && fallbackPressedStyle]} onPress={onPress}>
        <Text style={fallbackTextStyle}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <GlassView isInteractive glassEffectStyle="regular" colorScheme="dark" style={styles.glass}>
      <Pressable style={styles.glassPressable} onPress={onPress}>
        <Text style={styles.glassText}>{label}</Text>
      </Pressable>
    </GlassView>
  );
}

const styles = StyleSheet.create({
  glass: {
    height: 54,
    borderRadius: 27,
    overflow: 'hidden',
  },
  glassPressable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Glass is translucent over the navy background, so the label is white instead of navy.
  glassText: {
    fontFamily: 'SUIT-Bold',
    fontSize: 16,
    color: '#FFFFFF',
  },
});
