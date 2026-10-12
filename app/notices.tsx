import React, { useCallback, useRef, useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/services/api';
import { Notice, noticeDate, noticePreview } from '@/features/notices/types';
import { NoticeHeader, NoticeError, styles } from '@/features/notices/ui';

export default function NoticesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<Notice[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const busy = useRef(false);
  const generation = useRef(0);
  const load = useCallback(async (offset = 0) => {
    if (busy.current && offset > 0) return;
    const request = ++generation.current;
    busy.current = true; setLoading(true); setError('');
    try {
      const data = await api.getNotices(offset);
      if (request !== generation.current) return;
      setItems(previous => offset ? [...previous, ...data.notices.filter(item => !previous.some(row => row.id === item.id))] : data.notices);
      setHasMore(data.hasMore); setCanManage(data.canManage);
    } catch (e: any) { if (request === generation.current) setError(e.message || '공지사항을 불러오지 못했습니다.'); }
    finally { if (request === generation.current) { busy.current = false; setLoading(false); } }
  }, []);
  useFocusEffect(useCallback(() => { void load(); return () => { generation.current++; busy.current = false; }; }, [load]));
  return <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
    <NoticeHeader title="공지사항" />
    <FlatList data={items} keyExtractor={item => String(item.id)} refreshing={loading} onRefresh={() => load()}
      contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: canManage ? 100 : 24, flexGrow: 1 }}
      ListEmptyComponent={!loading ? <NoticeError message={error || '등록된 공지사항이 없습니다.'} retry={error ? () => load() : undefined} /> : null}
      ListFooterComponent={items.length ? <View style={{ padding: 16 }}>{error ? <NoticeError message={error} retry={() => load()} /> : hasMore ?
        <Pressable disabled={loading} onPress={() => load(items.length)} style={styles.button}>{loading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>더 보기</Text>}</Pressable> : null}</View> : null}
      renderItem={({ item }) => <Pressable onPress={() => router.push({ pathname: '/notice-detail', params: { id: item.id } })}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 20, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.12)', opacity: pressed ? 0.6 : 1 })}>
        <View style={{ flex: 1, gap: 5 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.body, { fontFamily: 'SUIT-SemiBold', flexShrink: 1 }]}>{item.title}</Text>
            {item.pinned && <View style={styles.pinnedBadge}><Text style={styles.pinnedBadgeText}>고정</Text></View>}
          </View>
          <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.muted, { fontSize: 13 }]}>{noticePreview(item.content)}</Text>
        </View>
        <View style={{ width: 82, alignItems: 'flex-end' }}>
          <Text style={[styles.muted, { fontSize: 11 }]}>{noticeDate(item.createdAt)}</Text>
          <Text numberOfLines={1} style={[styles.muted, { fontSize: 12 }]}>{item.authorName}</Text>
        </View>
      </Pressable>} />
    {canManage && <Pressable accessibilityLabel="공지사항 작성" onPress={() => router.push('/notice-edit')}
      style={{ position: 'absolute', bottom: insets.bottom + 20, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#306093', alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }}>
      <Ionicons name="pencil" size={24} color="white" />
    </Pressable>}
  </View>;
}
