import React from 'react';
import { StyleSheet } from 'react-native';
import { LiquidGlassView } from '@/utils/liquidGlass';

type Props = {
  radius?: number;
  // Buttons react to touch; panels (sheets, menus, popups) stay still.
  interactive?: boolean;
  tintColor?: string;
};

// Liquid Glass layer behind an existing surface (button, sheet, menu, popup) on iOS 26+.
// Put it first inside the surface and add `glassClear` to the surface's style so its own
// background gives way to the glass. Elsewhere it renders nothing and the surface looks as before.
export default function GlassBackground({ radius = 0, interactive = false, tintColor }: Props) {
  if (!LiquidGlassView) return null;
  return (
    <LiquidGlassView
      pointerEvents="none"
      isInteractive={interactive}
      glassEffectStyle="regular"
      colorScheme="dark"
      tintColor={tintColor}
      style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
    />
  );
}

export const glassClear = LiquidGlassView ? { backgroundColor: 'transparent' } : null;

// Panels hold text, so they keep a navy tint for legibility over whatever is behind them.
export const PANEL_TINT = 'rgba(8,55,99,0.55)';
