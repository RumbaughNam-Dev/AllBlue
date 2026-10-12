import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/services/api';
import { NoticeInput } from '@/features/notices/types';
import { NoticeHeader, NoticeError, styles } from '@/features/notices/ui';
export default function NoticeEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter(); const insets = useSafeAreaInsets();
  const [form, setForm] = useState<NoticeInput>({ title: '', content: '', pinned: false, popup: false });
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [canManage, setCanManage] = useState(false); const [saving, setSaving] = useState(false);
  const busy = useRef(false); const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    (async () => {
      try {
        if (id) {
          const data = await api.getNotice(Number(id));
          if (active) { setCanManage(data.canManage); setForm({ title: data.notice.title, content: data.notice.content, pinned: data.notice.pinned, popup: data.notice.popup }); }
        } else {
          const data = await api.getNotices(); if (active) setCanManage(data.canManage);
        }
      } catch (e: any) { if (active) setError(e.message || '화면을 불러오지 못했습니다.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [id, retry]);
  const save = async () => {
    if (busy.current || !canManage) return;
    if (!form.title.trim() || !form.content.trim()) { Alert.alert('입력 확인', '제목과 내용을 입력해주세요.'); return; }
    busy.current = true; setSaving(true);
    try {
      if (id) { await api.updateNotice(Number(id), form); router.back(); }
      else { const data = await api.createNotice(form); router.replace({ pathname: '/notice-detail', params: { id: data.notice.id } }); }
    } catch (e: any) { if (!e._handled) Alert.alert('저장 실패', e.message); }
    finally { busy.current = false; setSaving(false); }
  };
  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom + 12 }]}>
    <NoticeHeader title={id ? '공지사항 수정' : '공지사항 작성'} />
    {loading ? <ActivityIndicator color="white" style={{ flex: 1 }} /> : error ? <NoticeError message={error} retry={() => setRetry(value => value + 1)} /> : !canManage ? <NoticeError message="관리자만 작성할 수 있습니다." /> : <>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, gap: 24 }}>
        <View><Text style={styles.label}>제목</Text><TextInput accessibilityLabel="제목" placeholder="제목을 입력해주세요" placeholderTextColor="#A8BFD6" style={styles.input} maxLength={200} value={form.title} onChangeText={title => setForm(value => ({ ...value, title }))} editable={!saving} /></View>
        <View><Text style={styles.label}>내용</Text><TextInput accessibilityLabel="내용" placeholder="내용을 입력해주세요" placeholderTextColor="#A8BFD6" style={[styles.input, { minHeight: 240, textAlignVertical: 'top' }]} multiline maxLength={20000} value={form.content} onChangeText={content => setForm(value => ({ ...value, content }))} editable={!saving} /></View>
        <View><Text style={styles.label}>상단 유지</Text><View style={{ flexDirection: 'row', gap: 24 }}>
          {[true, false].map(value => <Pressable key={String(value)} disabled={saving} accessibilityRole="radio" accessibilityState={{ checked: form.pinned === value }} onPress={() => setForm(form => ({ ...form, pinned: value }))} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 }}>
            <Ionicons name={form.pinned === value ? 'radio-button-on' : 'radio-button-off'} size={23} color="white" /><Text style={styles.body}>{value ? '사용' : '사용 안 함'}</Text>
          </Pressable>)}
        </View></View>
        <Pressable disabled={saving} accessibilityRole="checkbox" accessibilityState={{ checked: form.popup }} onPress={() => setForm(value => ({ ...value, popup: !value.popup }))} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }}>
          <Ionicons name={form.popup ? 'checkbox' : 'square-outline'} size={24} color="white" /><Text style={styles.body}>팝업 보이기</Text>
        </Pressable>
      </ScrollView>
      <View style={styles.footer}><Pressable disabled={saving} onPress={save} style={[styles.button, { flex: 1, opacity: saving ? 0.6 : 1 }]}><Text style={styles.buttonText}>{saving ? '저장 중…' : '저장'}</Text></Pressable></View>
    </>}
  </KeyboardAvoidingView>;
}
