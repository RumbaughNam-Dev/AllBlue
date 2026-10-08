import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PopupBackdrop from './PopupBackdrop';
import UserProfileView from './UserProfileView';
import ProfileAvatar from './ProfileAvatar';
import Colors from '@/constants/Colors';
import { api, TemporaryLinkPreview } from '@/services/api';
import { useSearch } from '@/hooks/useSearch';
import { useLatestRequest } from '@/hooks/useLatestRequest';

type Props = {
  visible: boolean;
  scheduleId: number;
  source: { id: number; nickname: string } | null;
  onClose: () => void;
  onLinked: () => void;
};
export default function TemporaryUserLinkModal({ visible, scheduleId, source, onClose, onLinked }: Props) {
  const insets = useSafeAreaInsets();
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const topSpace = Math.max(20, insets.top);
  const bottomSpace = Math.max(20, insets.bottom);
  const cardMaxHeight = viewportHeight === null ? '100%' : Math.max(0, viewportHeight - topSpace - bottomSpace);
  const [query, setQuery] = useState('');
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [preview, setPreview] = useState<TemporaryLinkPreview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const request = useLatestRequest();
  const search = useCallback(async (q: string) => source ? (await api.temporaryLinkTargets(scheduleId, source.id, q)).users : [], [scheduleId, source?.id]);
  const results = useSearch(query, search, visible && !!source && !preview);

  useEffect(() => {
    const isCurrent = request.start();
    if (visible) Keyboard.dismiss();
    setQuery(''); setProfileUserId(null); setPreview(null); setConfirmed(false); setError('');
    busyRef.current = false; setBusy(false);
    return () => request.invalidate();
  }, [visible, scheduleId, source?.id, request]);

  const select = async (targetId: number) => {
    if (busyRef.current || !source) return;
    busyRef.current = true; setBusy(true); setError(''); Keyboard.dismiss();
    const isCurrent = request.start();
    try {
      const result = await api.previewTemporaryLink(scheduleId, source.id, targetId);
      if (isCurrent()) { setPreview(result); setConfirmed(false); }
    } catch (e: any) { if (isCurrent()) setError(e.message || '연결 정보를 불러오지 못했습니다.'); }
    finally { if (isCurrent()) { busyRef.current = false; setBusy(false); } }
  };
  const connect = async () => {
    if (!source || !preview || !confirmed || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    const isCurrent = request.start();
    try {
      const result = await api.linkTemporaryUser(scheduleId, source.id, preview.target.id, preview.confirmationToken);
      if (!isCurrent()) return;
      if (!result.success) throw new Error('연결에 실패했습니다.');
      onLinked();
      Alert.alert('연결 완료', `${source.nickname}님의 기록을 ${preview.target.nickname}님에게 연결했습니다.`);
    } catch (e: any) {
      if (isCurrent()) { setError(e.message || '연결에 실패했습니다. 내용을 다시 확인해주세요.'); setConfirmed(false); setPreview(null); }
    } finally { if (isCurrent()) { busyRef.current = false; setBusy(false); } }
  };
  const openProfile = (userId: string) => {
    if (busyRef.current) return;
    Keyboard.dismiss(); setProfileUserId(userId);
  };
  const close = () => { if (!busyRef.current) { Keyboard.dismiss(); onClose(); } };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => profileUserId ? setProfileUserId(null) : close()} onShow={Keyboard.dismiss}>
      <View style={styles.overlay}>
        <PopupBackdrop />
        <KeyboardAvoidingView style={styles.keyboard} pointerEvents={profileUserId ? 'none' : 'auto'}
          accessibilityElementsHidden={!!profileUserId} importantForAccessibility={profileUserId ? 'no-hide-descendants' : 'auto'} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[styles.viewport, { paddingTop: topSpace, paddingBottom: bottomSpace }]}
            onLayout={event => setViewportHeight(event.nativeEvent.layout.height)}>
          <View style={[styles.card, { maxHeight: cardMaxHeight }]} accessibilityViewIsModal>
            <View style={styles.header}>
              <Text style={styles.title}>가입 사용자로 연결</Text>
              <Pressable onPress={close} disabled={busyRef.current} accessibilityRole="button" accessibilityLabel="닫기"><Text style={styles.close}>✕</Text></Pressable>
            </View>
            <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.content}>
              {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
              {busy && <ActivityIndicator color="white" />}
              {source && !preview && <>
                <Text style={styles.text}>{source.nickname}님의 기록을 연결할 가입 사용자를 찾아주세요.</Text>
                <TextInput style={styles.input} value={query} onChangeText={setQuery} editable={!busy} placeholder="이름 또는 닉네임 검색"
                  placeholderTextColor="#B5C8DC" accessibilityLabel="연결할 사용자 검색"
                  returnKeyType="done" submitBehavior="blurAndSubmit" onSubmitEditing={Keyboard.dismiss} />
                {results.searching && <ActivityIndicator color="white" />}
                {results.error && <Text style={styles.error}>검색하지 못했습니다. 다시 검색해주세요.</Text>}
                {!results.searching && !results.error && !!query.trim() && results.completedQuery === query.trim() && results.results.length === 0 && <Text style={styles.text}>검색된 가입 사용자가 없어요.</Text>}
                {results.results.map(target => <View key={target.id} style={styles.person}>
                  <ProfileAvatar nickname={target.nickname} profileImage={target.profileImage} level={target.level} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.text}>{target.nickname}{target.name && target.name !== target.nickname ? ` (${target.name})` : ''}</Text>
                    <Text style={styles.hint}>{target.phoneHint ?? '등록된 전화번호 없음'}</Text>
                  </View>
                  <View style={styles.personActions}>
                    <Pressable accessibilityRole="button" accessibilityLabel={`${target.nickname} 프로필`} onPress={() => openProfile(target.userId)} disabled={busy} style={styles.smallButton}><Text style={styles.text}>프로필</Text></Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel={`${target.nickname} 연결`} onPress={() => select(target.id)} disabled={busy} style={styles.smallButton}><Text style={styles.text}>연결</Text></Pressable>
                  </View>
                </View>)}
              </>}
              {source && preview && <>
                <Text style={styles.title}>{source.nickname} → {preview.target.nickname}</Text>
                <Text style={styles.text}>{preview.target.name || preview.target.nickname} · 사용자 #{preview.target.id}</Text>
                <Text style={styles.text}>현재 일정뿐 아니라 이 임시 사용자의 모든 일정과 기록이 연결됩니다.</Text>
                <Text style={styles.text}>일정 {preview.counts.schedules}개 · 자격증 과정 {preview.counts.courses}개{ '\n' }디브리핑 {preview.counts.debriefings}개 · 서류 {preview.counts.forms}개 · 교육 진도 {preview.counts.achievements}개</Text>
                {preview.schedules.map(s => <Text key={s.id} style={styles.hint}>{s.date} · {s.title}</Text>)}
                <View style={styles.notice}>
                  <Text style={styles.text}>중복 일정 {preview.duplicates.schedules}개 · 과정 {preview.duplicates.courses}개 · 진도 {preview.duplicates.achievements}개</Text>
                  <Text style={styles.hint}>중복 일정은 가입 사용자의 기존 분류·참가 상태를 유지합니다. 같은 강사의 동일 과정은 합치고, 완료 기록을 우선합니다. 강사나 증서 번호가 다르면 별도 이력으로 보존합니다.</Text>
                  <Text style={styles.hint}>서류의 이름·서명·내용은 변경하지 않습니다.</Text>
                </View>
                <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: confirmed }} disabled={busy} onPress={() => setConfirmed(value => !value)} style={styles.person}>
                  <Text style={styles.text}>{confirmed ? '☑' : '☐'} 연결 대상과 전체 기록 범위를 확인했습니다.</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={connect} disabled={!confirmed || busy} style={[styles.primary, (!confirmed || busy) && { opacity: 0.45 }]}>
                  <Text style={styles.primaryText}>전체 기록 연결</Text>
                </Pressable>
                <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setPreview(null); setConfirmed(false); }}><Text style={styles.hint}>다른 사용자 선택</Text></Pressable>
              </>}
            </ScrollView>
          </View>
          </View>
        </KeyboardAvoidingView>
        {profileUserId && <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
          <UserProfileView userId={profileUserId} onClose={() => setProfileUserId(null)} />
        </View>}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1 }, keyboard: { flex: 1 },
  viewport: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  card: { backgroundColor: Colors.brand.primary, borderRadius: 20, padding: 20, flexShrink: 1 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  header: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  content: { gap: 14, paddingBottom: 12 }, title: { fontFamily: 'SUIT-Bold', fontSize: 17, color: 'white', flexShrink: 1 },
  text: { fontFamily: 'SUIT-SemiBold', fontSize: 14, lineHeight: 21, color: 'white' },
  hint: { fontFamily: 'SUIT-Regular', fontSize: 12, lineHeight: 19, color: '#C4D7E9' },
  error: { color: '#FFD1C7', fontSize: 14, lineHeight: 21 }, close: { color: 'white', fontSize: 22, padding: 6 },
  input: { borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', padding: 14, color: 'white', fontSize: 16 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  personActions: { flexDirection: 'row', gap: 6, flexShrink: 0 },
  smallButton: { padding: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.12)' },
  primary: { borderRadius: 12, padding: 16, backgroundColor: 'white', alignItems: 'center' },
  primaryText: { fontFamily: 'SUIT-Bold', color: Colors.brand.primary },
  notice: { padding: 14, gap: 10, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.13)' },
});
