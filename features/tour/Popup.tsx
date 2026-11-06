import React from 'react';
import { Modal, View, Text, StyleSheet, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/Colors';
import PopupBackdrop from '@/components/PopupBackdrop';
import GlassBackground, { glassClear, PANEL_TINT } from '@/components/GlassBackground';

const PROMINENT_TINT = 'rgba(255,255,255,0.85)';

// 투어 팝업 공통 틀: 가운데 유리 판 + 제목 (바깥을 누르면 닫힘)
export function Popup({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  // 아이폰 듀오: 오른쪽 여백(카메라 · 상태 표시)을 빼고 그림 (일반 폰은 좌우 안전 영역이 0)
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <PopupBackdrop />
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="닫기" />
      <KeyboardAvoidingView style={[styles.center, { paddingLeft: 20 + insets.left, paddingRight: 20 + insets.right }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined} pointerEvents="box-none">
        <View style={[styles.panel, glassClear]}>
          <GlassBackground radius={20} tintColor={PANEL_TINT} />
          <Text style={styles.title}>{title}</Text>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function Buttons({ confirm, onCancel, onConfirm, busy, disabled }: { confirm: string; onCancel: () => void; onConfirm: () => void; busy?: boolean; disabled?: boolean }) {
  return (
    <View style={styles.buttons}>
      <Pressable accessibilityRole="button" onPress={onCancel} style={({ pressed }) => [styles.cancel, pressed && { opacity: 0.6 }]}>
        <Text style={styles.cancelText}>취소</Text>
      </Pressable>
      <Pressable accessibilityRole="button" disabled={busy || disabled} onPress={onConfirm}
        style={({ pressed }) => [styles.confirm, glassClear, pressed && { opacity: 0.85 }, (busy || disabled) && { opacity: 0.5 }]}>
        <GlassBackground radius={14} interactive tintColor={PROMINENT_TINT} />
        {busy ? <ActivityIndicator color={Colors.brand.primary} /> : <Text style={styles.confirmText}>{confirm}</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  panel: { alignSelf: 'center', width: '100%', maxWidth: 400, borderRadius: 20, padding: 20, backgroundColor: Colors.brand.deep },
  title: { fontFamily: 'SUIT-Bold', fontSize: 18, color: Colors.brand.white, textAlign: 'center' },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancel: { flex: 1, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  cancelText: { fontFamily: 'SUIT-SemiBold', fontSize: 15, color: Colors.brand.white },
  confirm: { flex: 1, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.brand.white },
  confirmText: { fontFamily: 'SUIT-Bold', fontSize: 15, color: Colors.brand.primary },
});
