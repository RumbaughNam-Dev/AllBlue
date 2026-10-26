import React, { useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PopupBackdrop from './PopupBackdrop';
import GlassBackground, { glassClear } from '@/components/GlassBackground';

export default function CertificateImageViewer({ imageUrl, onClose }: { imageUrl: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  return <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={onClose}>
    <PopupBackdrop />
    <View accessibilityViewIsModal style={[styles.root, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + 24 }]}>
      {!failed && <Image source={{ uri: imageUrl }} accessibilityLabel="승인된 자격증 이미지" resizeMode="contain" style={styles.image}
        onLoad={() => setLoading(false)} onError={() => { setLoading(false); setFailed(true); }} />}
      {loading && <ActivityIndicator color="white" style={StyleSheet.absoluteFill} />}
      {failed && <Text style={styles.error}>이미지를 불러오지 못했습니다.</Text>}
      <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="자격증 이미지 닫기" hitSlop={8}
        style={[styles.close, glassClear, { top: insets.top + 8 }]}>
        <GlassBackground radius={22} interactive /><Ionicons name="close" size={28} color="white" /></Pressable>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 16, justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  error: { color: 'white', fontFamily: 'SUIT-Regular', fontSize: 15, textAlign: 'center' },
  close: { position: 'absolute', right: 16, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)' },
});
