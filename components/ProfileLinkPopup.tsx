import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Modal, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/Colors';
import type { ProfileLink } from '@/services/api';
import PopupBackdrop from '@/components/PopupBackdrop';
import GlassBackground, { glassClear, PANEL_TINT } from '@/components/GlassBackground';
import { PROFILE_LINK_LIMITS, linkErrors, normalizeLinkUrl } from '@/utils/profileLinks';

const PROMINENT_TINT = 'rgba(255,255,255,0.85)';

const ERROR = '#FF6B6B';

// 프로필 링크 추가: 링크 이름 + URL. 잘못된 주소면 칸 아래 빨간 글씨, '확인' 비활성.
// initial을 주면 고치기: 내용이 채워진 채 열리고 아래 '삭제'
export default function ProfileLinkPopup({ visible, initial, onClose, onAdd, onDelete }: {
  visible: boolean;
  initial?: ProfileLink | null;
  onClose: () => void;
  onAdd: (link: ProfileLink) => void;
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
        maxLength={PROFILE_LINK_LIMITS.nameMax + 5}
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
        maxLength={PROFILE_LINK_LIMITS.urlMax}
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

// 가운데 팝업 (아이폰 듀오는 오른쪽 여백을 빼고 그림)
function Popup({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
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

function Buttons({ confirm, onCancel, onConfirm, busy, disabled }: { confirm: string; onCancel: () => void; onConfirm: () => void; busy?: boolean; disabled?: boolean }) {
  return (
    <View style={styles.buttons}>
      <Pressable accessibilityRole="button" onPress={onCancel} style={({ pressed }) => [styles.cancel, pressed && { opacity: 0.6 }]}>
        <Text style={styles.cancelText}>취소</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        disabled={busy || disabled}
        onPress={onConfirm}
        style={({ pressed }) => [styles.confirm, glassClear, pressed && { opacity: 0.85 }, (busy || disabled) && { opacity: 0.5 }]}
      >
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
  cancel: {
    flex: 1, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  cancelText: { fontFamily: 'SUIT-SemiBold', fontSize: 15, color: Colors.brand.white },
  confirm: { flex: 1, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.brand.white },
  confirmText: { fontFamily: 'SUIT-Bold', fontSize: 15, color: Colors.brand.primary },
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
