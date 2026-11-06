import React, { useEffect, useState } from 'react';
import { Text, TextInput, StyleSheet, View } from 'react-native';
import Colors from '@/constants/Colors';
import { Buttons, Popup } from './Popup';

export const REVIEW_NOTE_MAX = 500;

// 17 · 20장 '보완 요청': 관리자가 등록자에게 보완할 점을 적어 보냄 (필수 · 500자)
export default function ReviewNotePopup({ visible, title, subtitle, confirm = '보내기', initial = '', onClose, onSubmit }: {
  visible: boolean;
  title: string;
  subtitle: string;
  confirm?: string;
  initial?: string;
  onClose: () => void;
  onSubmit: (note: string) => Promise<void>;
}) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (visible) { setNote(initial); setBusy(false); } }, [visible, initial]);
  const ready = !!note.trim() && note.trim().length <= REVIEW_NOTE_MAX;
  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    try { await onSubmit(note.trim()); } finally { setBusy(false); }
  };
  return (
    <Popup visible={visible} title={title} onClose={onClose}>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <TextInput
        style={styles.input}
        value={note}
        onChangeText={setNote}
        placeholder="예) 일정표 이미지를 추가해 주세요"
        placeholderTextColor="rgba(255,255,255,0.3)"
        maxLength={REVIEW_NOTE_MAX}
        multiline
        autoFocus
        accessibilityLabel="보완할 점"
      />
      <Text style={styles.count}>{note.trim().length}/{REVIEW_NOTE_MAX}</Text>
      <View style={styles.spacer} />
      <Buttons confirm={confirm} onCancel={onClose} onConfirm={submit} busy={busy} disabled={!ready} />
    </Popup>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontFamily: 'SUIT-Regular', fontSize: 13, lineHeight: 19, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: 6, marginBottom: 14 },
  input: {
    minHeight: 110, maxHeight: 200, padding: 12, borderRadius: 12, textAlignVertical: 'top',
    fontFamily: 'SUIT-Regular', fontSize: 15, color: Colors.brand.white,
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  count: { alignSelf: 'flex-end', marginTop: 6, fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  spacer: { height: 2 },
});
