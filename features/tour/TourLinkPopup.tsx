import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import Colors from '@/constants/Colors';
import type { TourLink } from '@/services/api';
import { Buttons, Popup } from './TourManagePopups';
import { TOUR_FORM_LIMITS as L, linkErrors, normalizeLinkUrl } from './tourForm';

const ERROR = '#FF6B6B';

// 링크 추가 (14 · 17장): 링크 이름 + URL. 잘못된 주소면 칸 아래 빨간 글씨, '확인' 비활성.
// initial을 주면 고치기: 내용이 채워진 채 열리고 아래 '삭제' (14장)
export default function TourLinkPopup({ visible, initial, onClose, onAdd, onDelete }: {
  visible: boolean;
  initial?: TourLink | null;
  onClose: () => void;
  onAdd: (link: TourLink) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  useEffect(() => { if (visible) { setName(initial?.name ?? ''); setUrl(initial?.url ?? ''); } }, [visible, initial]);
  const errors = linkErrors(name, url);
  const normalized = normalizeLinkUrl(url);
  const ready = !!name.trim() && !!normalized && !errors.name;

  return (
    <Popup visible={visible} title={initial ? '링크 수정' : '링크 추가'} onClose={onClose}>
      <Text style={styles.label}>링크 이름</Text>
      <TextInput
        style={[styles.input, errors.name && styles.inputError]}
        value={name}
        onChangeText={setName}
        placeholder="예) 카카오톡 오픈채팅"
        placeholderTextColor="rgba(255,255,255,0.3)"
        maxLength={L.linkNameMax + 5}
        autoFocus={!initial}
        returnKeyType="next"
      />
      {errors.name && <Text style={styles.error}>{errors.name}</Text>}
      <Text style={styles.label}>URL</Text>
      <TextInput
        style={[styles.input, errors.url && styles.inputError]}
        value={url}
        onChangeText={setUrl}
        placeholder="https://open.kakao.com/..."
        placeholderTextColor="rgba(255,255,255,0.3)"
        maxLength={L.linkUrlMax}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        returnKeyType="done"
      />
      {errors.url && <Text style={styles.error}>{errors.url}</Text>}
      <View style={styles.spacer} />
      <Buttons
        confirm="확인"
        onCancel={onClose}
        disabled={!ready}
        onConfirm={() => { if (ready) onAdd({ name: name.trim(), url: normalized as string }); }}
      />
      {initial && onDelete && (
        <Pressable accessibilityRole="button" onPress={onDelete} hitSlop={8} style={({ pressed }) => [styles.delete, pressed && { opacity: 0.6 }]}>
          <Text style={styles.deleteText}>삭제</Text>
        </Pressable>
      )}
    </Popup>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: 'SUIT-SemiBold', fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 16, marginBottom: 6 },
  input: {
    fontFamily: 'SUIT-Regular', fontSize: 15, color: Colors.brand.white,
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  inputError: { borderColor: ERROR },
  error: { fontFamily: 'SUIT-SemiBold', fontSize: 12, color: ERROR, marginTop: 6 },
  spacer: { height: 4 },
  delete: { alignSelf: 'center', marginTop: 14, paddingVertical: 4, paddingHorizontal: 12 },
  deleteText: { fontFamily: 'SUIT-SemiBold', fontSize: 14, color: ERROR },
});
