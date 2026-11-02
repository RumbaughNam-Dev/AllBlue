import React, { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PopupBackdrop from '@/components/PopupBackdrop';
import GlassBackground, { glassClear } from '@/components/GlassBackground';

// 사진 크게 보기 (자격증 이미지 보기와 같은 모양) + 여러 장이면 좌우로 넘김
export default function ImageViewer({ images, index = 0, onClose }: { images: string[]; index?: number; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [page, setPage] = useState(index);
  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <PopupBackdrop />
      <View accessibilityViewIsModal style={styles.root}>
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}
          contentOffset={{ x: index * width, y: 0 }}
          onMomentumScrollEnd={e => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}>
          {images.map(uri => (
            <ScrollView key={uri} style={{ width, height }} maximumZoomScale={3} minimumZoomScale={1} centerContent
              contentContainerStyle={[styles.page, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + 40 }]}>
              <Image source={{ uri }} resizeMode="contain" style={{ width: width - 32, height: height - insets.top - insets.bottom - 104 }} />
            </ScrollView>
          ))}
        </ScrollView>
        {images.length > 1 && <Text style={[styles.counter, { bottom: insets.bottom + 14 }]}>{page + 1} / {images.length}</Text>}
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="사진 닫기" hitSlop={8}
          style={[styles.close, glassClear, { top: insets.top + 8, right: 16 + insets.right }]}>
          <GlassBackground radius={22} interactive /><Ionicons name="close" size={28} color="white" />
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)' },
  page: { alignItems: 'center', justifyContent: 'center', flexGrow: 1 },
  counter: { position: 'absolute', alignSelf: 'center', fontFamily: 'SUIT-SemiBold', fontSize: 13, color: 'white' },
  close: { position: 'absolute', width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)' },
});
