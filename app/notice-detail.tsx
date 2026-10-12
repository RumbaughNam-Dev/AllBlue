import React, { useCallback, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/services/api';
import { Notice, noticeDate } from '@/features/notices/types';
import { NoticeHeader, NoticeError, styles } from '@/features/notices/ui';
export default function NoticeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter(); const insets = useSafeAreaInsets();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false); const deletingRef = useRef(false);
  const [retry, setRetry] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true; setLoading(true); setError('');
    api.getNotice(Number(id)).then(data => { if (active) { setNotice(data.notice); setCanManage(data.canManage); } })
      .catch(e => { if (active) { setNotice(null); setError(e.message || '공지사항을 불러오지 못했습니다.'); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, retry]));
  const remove = () => Alert.alert('공지사항 삭제', '이 공지사항을 삭제할까요?', [
    { text: '취소', style: 'cancel' }, { text: '삭제', style: 'destructive', onPress: async () => {
      if (deletingRef.current) return;
      deletingRef.current = true; setDeleting(true);
      try { await api.deleteNotice(Number(id)); router.back(); }
      catch (e: any) { if (!e._handled) Alert.alert('삭제 실패', e.message); }
      finally { deletingRef.current = false; setDeleting(false); }
    } },
  ]);
  return <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom + 12 }]}>
    <NoticeHeader />
    {loading ? <ActivityIndicator color="white" style={{ flex: 1 }} /> : error ? <NoticeError message={error} retry={() => setRetry(value => value + 1)} /> : notice && <>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}>
        <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">{notice.title}</Text>
        <Text style={[styles.muted, { marginTop: 10, marginBottom: 28 }]}>{noticeDate(notice.createdAt)}  ·  {notice.authorName}</Text>
        <Text style={styles.body} selectable>{notice.content}</Text>
      </ScrollView>
      {canManage && <View style={styles.footer}>
        <Pressable disabled={deleting} style={[styles.button, { flex: 1 }]} onPress={() => router.push({ pathname: '/notice-edit', params: { id } })}><Text style={styles.buttonText}>수정</Text></Pressable>
        <Pressable disabled={deleting} style={[styles.button, { flex: 1 }]} onPress={remove}><Text style={styles.buttonText}>{deleting ? '삭제 중…' : '삭제'}</Text></Pressable>
      </View>}
    </>}
  </View>;
}
