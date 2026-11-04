import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/Colors';
import PopupBackdrop from '@/components/PopupBackdrop';
import GlassBackground, { glassClear, PANEL_TINT } from '@/components/GlassBackground';
import { LIMITS, REPORT_REASONS } from './ui';

const PROMINENT_TINT = 'rgba(255,255,255,0.85)';

// 사유를 골라야 신고할 수 있고, '기타'는 자세한 내용을 적어야 함
export function canSubmitReport(reason: string | null, memo: string) {
  return !!reason && memo.trim().length <= LIMITS.reportMemoMax && (reason !== 'ETC' || !!memo.trim());
}

export function Popup({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  // 아이폰 듀오: 오른쪽 여백(카메라 · 상태 표시)을 빼고 그림 (일반 폰은 좌우 안전 영역이 0)
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <PopupBackdrop />
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="닫기" />
      <KeyboardAvoidingView style={[styles.center, { paddingLeft: 24 + insets.left, paddingRight: 24 + insets.right }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined} pointerEvents="box-none">
        <View style={[styles.panel, glassClear]}>
          <GlassBackground radius={20} tintColor={PANEL_TINT} />
          <Text style={styles.title}>{title}</Text>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function PopupButtons({ confirm, onCancel, onConfirm, busy, disabled }: { confirm: string; onCancel: () => void; onConfirm: () => void; busy?: boolean; disabled?: boolean }) {
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

// 11장 신고하기: 사유 4종 + 자세한 내용(선택 · 200자, 기타면 필수). 같은 대상은 한 번만
export default function ReportPopup({ visible, title, onClose, onSubmit }: {
  visible: boolean; title: string; onClose: () => void; onSubmit: (reason: string, memo: string) => Promise<void>;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const [memo, setMemo] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (visible) { setReason(null); setMemo(''); setBusy(false); } }, [visible]);
  const submit = async () => {
    if (!canSubmitReport(reason, memo)) return;
    setBusy(true);
    try { await onSubmit(reason!, memo.trim()); } finally { setBusy(false); }
  };
  return (
    <Popup visible={visible} title={title} onClose={onClose}>
      <Text style={styles.subtitle}>신고 사유를 골라 주세요</Text>
      {REPORT_REASONS.map(option => {
        const selected = reason === option.code;
        return (
          <Pressable key={option.code} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => setReason(option.code)}
            style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && { opacity: 0.7 }]}>
            <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={18} color={selected ? '#00E5FF' : 'rgba(255,255,255,0.4)'} />
            <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
      <TextInput style={[styles.memo, reason === 'ETC' && !memo.trim() && styles.memoRequired]} value={memo} onChangeText={setMemo}
        placeholder={reason === 'ETC' ? '기타 사유를 적어 주세요 (200자)' : '자세한 내용 (선택 · 200자)'}
        placeholderTextColor="rgba(255,255,255,0.3)" maxLength={LIMITS.reportMemoMax} multiline />
      <PopupButtons confirm="신고하기" onCancel={onClose} onConfirm={submit} busy={busy} disabled={!canSubmitReport(reason, memo)} />
    </Popup>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  panel: { alignSelf: 'center', width: '100%', maxWidth: 400, borderRadius: 20, padding: 20, backgroundColor: Colors.brand.deep },
  title: { fontFamily: 'SUIT-Bold', fontSize: 18, color: Colors.brand.white, textAlign: 'center' },
  subtitle: { fontFamily: 'SUIT-Regular', fontSize: 13, color: 'rgba(255,255,255,0.55)', textAlign: 'center', marginTop: 6, marginBottom: 12 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)' },
  optionSelected: { backgroundColor: 'rgba(0,229,255,0.12)' },
  optionText: { fontFamily: 'SUIT-Regular', fontSize: 15, color: 'rgba(255,255,255,0.85)' },
  optionTextSelected: { fontFamily: 'SUIT-SemiBold', color: '#00E5FF' },
  memo: {
    minHeight: 72, marginTop: 4, padding: 12, borderRadius: 12, textAlignVertical: 'top', fontFamily: 'SUIT-Regular', fontSize: 14,
    color: Colors.brand.white, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  memoRequired: { borderColor: '#FF6B6B' },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancel: { flex: 1, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  cancelText: { fontFamily: 'SUIT-SemiBold', fontSize: 15, color: Colors.brand.white },
  confirm: { flex: 1, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.brand.white },
  confirmText: { fontFamily: 'SUIT-Bold', fontSize: 15, color: Colors.brand.primary },
});
