import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { Buttons, Popup } from './Popup';

const ERROR = '#FF6B6B';
export const REPORT_MEMO_MAX = 200;
// Mirrors common_code TOUR_REPORT_REASON
export const REPORT_REASONS = [
  { code: 'INAPPROPRIATE', label: '부적절한 사진 · 내용' },
  { code: 'FALSE_INFO', label: '사실과 다른 정보' },
  { code: 'NO_CONTACT', label: '연락이 안 돼요' },
  { code: 'ETC', label: '기타 (직접 입력)' },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]['code'];

// 사유를 골라야 신고할 수 있고, '기타'는 자세한 내용을 적어야 함
export function canSubmitReport(reason: ReportReason | null, memo: string) {
  return !!reason && memo.trim().length <= REPORT_MEMO_MAX && (reason !== 'ETC' || !!memo.trim());
}

// 20장 투어 신고: 사유 고르기 + 자세한 내용(선택 · 200자)
export default function TourReportPopup({ visible, onClose, onSubmit }: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: ReportReason, memo: string) => Promise<void>;
}) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [memo, setMemo] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (visible) { setReason(null); setMemo(''); setBusy(false); } }, [visible]);

  const submit = async () => {
    if (!reason || !canSubmitReport(reason, memo)) return;
    setBusy(true);
    try { await onSubmit(reason, memo.trim()); } finally { setBusy(false); }
  };

  return (
    <Popup visible={visible} title="투어 신고" onClose={onClose}>
      <Text style={styles.subtitle}>신고 사유를 골라 주세요</Text>
      {REPORT_REASONS.map(option => {
        const selected = reason === option.code;
        return (
          <Pressable
            key={option.code}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => setReason(option.code)}
            style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={18} color={selected ? '#00E5FF' : 'rgba(255,255,255,0.4)'} />
            <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
      <TextInput
        style={[styles.memo, reason === 'ETC' && !memo.trim() && styles.memoRequired]}
        value={memo}
        onChangeText={setMemo}
        placeholder={reason === 'ETC' ? '기타 사유를 적어 주세요 (200자)' : '자세한 내용 (선택 · 200자)'}
        placeholderTextColor="rgba(255,255,255,0.3)"
        maxLength={REPORT_MEMO_MAX}
        multiline
      />
      <View style={styles.spacer} />
      <Buttons confirm="신고하기" onCancel={onClose} onConfirm={submit} busy={busy} disabled={!canSubmitReport(reason, memo)} />
    </Popup>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontFamily: 'SUIT-Regular', fontSize: 13, color: 'rgba(255,255,255,0.55)', textAlign: 'center', marginTop: 6, marginBottom: 12 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8,
    borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)',
  },
  optionSelected: { backgroundColor: 'rgba(0,229,255,0.12)' },
  optionText: { fontFamily: 'SUIT-Regular', fontSize: 15, color: 'rgba(255,255,255,0.85)' },
  optionTextSelected: { fontFamily: 'SUIT-SemiBold', color: '#00E5FF' },
  memo: {
    minHeight: 72, marginTop: 4, padding: 12, borderRadius: 12, textAlignVertical: 'top',
    fontFamily: 'SUIT-Regular', fontSize: 14, color: Colors.brand.white,
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  memoRequired: { borderColor: ERROR },
  spacer: { height: 4 },
});
