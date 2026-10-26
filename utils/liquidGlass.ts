import type React from 'react';
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

// Liquid Glass view on iOS 26+, otherwise null so callers draw their existing fallback.
// The glass native module may be missing from a store build that predates it, and loading
// GlassView without it would crash, so check for the module before requiring the component.
export const LiquidGlassView: React.ComponentType<any> | null = (() => {
  if (Platform.OS !== 'ios' || !requireOptionalNativeModule('ExpoGlassEffect')) return null;
  const glass = require('expo-glass-effect');
  return glass.isLiquidGlassAvailable() ? glass.GlassView : null;
})();
