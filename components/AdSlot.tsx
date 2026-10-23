import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, StyleProp, ViewStyle, ImageSourcePropType, Image as RNImage, LayoutChangeEvent, Linking } from 'react-native';
import { Image } from 'expo-image';

type Props = {
  source: ImageSourcePropType | null;
  style?: StyleProp<ViewStyle>;
  // 'width': always span the full width; height follows the image ratio.
  fit?: 'contain' | 'width';
  // Opened in the device's default browser on tap.
  url?: string | null;
};

// The slot is the space available; the image is fitted inside it at its own ratio
// so it is never cropped or stretched. Too wide → full height, narrower width;
// too tall → full width, shorter height. Centered either way.
export default function AdSlot({ source, style, fit = 'contain', url }: Props) {
  const [box, setBox] = useState({ width: 0, height: 0 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox({ width, height });
  };

  if (!source) {
    return (
      <View style={[styles.slot, styles.empty, style]}>
        <Text style={styles.label}>AD</Text>
      </View>
    );
  }

  const openLink = url ? () => { Linking.openURL(url).catch(() => {}); } : undefined;

  const asset = RNImage.resolveAssetSource(source as Parameters<typeof RNImage.resolveAssetSource>[0]);
  const ratio = asset?.width && asset?.height ? asset.width / asset.height : 0;
  if (fit === 'width') {
    return (
      <Pressable
        disabled={!openLink}
        onPress={openLink}
        style={({ pressed }) => [styles.slot, { aspectRatio: ratio || undefined }, style, pressed && styles.pressed]}
      >
        <Image source={source} style={StyleSheet.absoluteFill} contentFit="contain" />
      </Pressable>
    );
  }

  let fitted = { width: box.width, height: box.height };
  if (ratio > 0 && box.width > 0 && box.height > 0) {
    fitted = box.width / box.height > ratio
      ? { width: box.height * ratio, height: box.height }
      : { width: box.width, height: box.width / ratio };
  }

  return (
    <View style={[styles.fitBox, style]} onLayout={onLayout}>
      {box.width > 0 && (
        <Pressable
          disabled={!openLink}
          onPress={openLink}
          style={({ pressed }) => [styles.slot, fitted, pressed && styles.pressed]}
        >
          <Image source={source} style={StyleSheet.absoluteFill} contentFit="contain" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fitBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  slot: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.8,
  },
  empty: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: 'SUIT-SemiBold',
    fontSize: 11,
    color: 'rgba(255,255,255,0.25)',
  },
});
