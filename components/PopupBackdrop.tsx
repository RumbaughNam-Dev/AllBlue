import React, { createContext, useContext, useRef } from 'react';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurTargetView, BlurView } from 'expo-blur';

const PopupBlurTarget = createContext<React.RefObject<View | null> | undefined>(undefined);

// Popups live in native Modal windows, outside this Android blur target.
export function PopupBlurProvider({ children }: React.PropsWithChildren) {
  const target = useRef<View | null>(null);
  return (
    <PopupBlurTarget.Provider value={target}>
      {Platform.OS === 'android' ? (
        <BlurTargetView ref={target} style={styles.fill}>{children}</BlurTargetView>
      ) : children}
    </PopupBlurTarget.Provider>
  );
}

export default function PopupBackdrop() {
  const target = useContext(PopupBlurTarget);
  if (Platform.OS === 'web') {
    return <View pointerEvents="none" style={[StyleSheet.absoluteFill, {
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      backgroundColor: 'rgba(8, 30, 53, 0.06)',
    } as ViewStyle]} />;
  }
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <BlurView
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        intensity={Platform.OS === 'android' ? 24 : 65}
        tint={Platform.OS === 'android' ? 'default' : 'systemUltraThinMaterialLight'}
        {...(Platform.OS === 'android' ? {
          blurMethod: 'dimezisBlurView' as const,
          blurTarget: target,
          // A softer 12px radius keeps the background recognizable.
          blurReductionFactor: 2,
        } : {})}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(8, 30, 53, 0.06)' }]} />
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
