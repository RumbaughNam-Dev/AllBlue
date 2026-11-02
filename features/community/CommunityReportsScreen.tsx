import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppRouter } from '@/features/split/SplitPane';
import { api, type CommunityReportItem } from '@/services/api';
import { BOARD_NAME, CenterMessage, CommunityHeader, reportReasonLabel, styles as ui, timeAgo } from './ui';

const TARGET_NAME = { POST: '글', COMMENT: '댓글', GREETING: '출석인사' } as const;

// 11장 admin 커뮤니티 신고 처리: 대상별로 묶어 신고 수 · 사유, '문제 없음' 또는 '내리기'(지우고 작성자에게 알림)
export default function CommunityReportsScreen() {
  const router = useAppRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<CommunityReportItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setItems((await api.getCommunityReports()).items); setError(null); }
    catch (e: any) { setError(e?.status === 403 ? '관리자만 볼 수 있어요.' : '신고를 불러오지 못했어요.'); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const process = (item: CommunityReportItem, decision: 'dismiss' | 'take-down') => {
    const noun = TARGET_NAME[item.targetType];
    const [title, message, action] = decision === 'dismiss'
      ? ['문제 없음', `이 ${noun}의 신고 ${item.count}건을 닫을까요?`, '문제 없음']
      : [`${noun} 내리기`, `이 ${noun}을(를) 지우고 작성자에게 알릴까요?`, '내리기'];
    Alert.alert(title, message, [
      { text: '취소', style: 'cancel' },
      { text: action, style: decision === 'dismiss' ? 'default' : 'destructive', onPress: async () => {
        const key = `${item.targetType}:${item.targetId}`;
        setBusy(key);
        try {
          await api.processCommunityReport(item.targetType, item.targetId, decision);
          setItems(prev => prev?.filter(i => !(i.targetType === item.targetType && i.targetId === item.targetId)) ?? null);
        } catch (e: any) {
          if (!e?._handled) Alert.alert('처리하지 못했어요', e?.message ?? '다시 시도해 주세요.');
          void load();
        } finally { setBusy(null); }
      } },
    ]);
  };

  return (
    <View style={[ui.screen, { paddingTop: insets.top }]}>
      <CommunityHeader title="커뮤니티 신고 처리" />
      {!items ? <CenterMessage loading={!error} message={error ?? ''} onRetry={error ? load : undefined} /> : (
        <FlatList
          data={items}
          keyExtractor={item => `${item.targetType}:${item.targetId}`}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }, !items.length && { flexGrow: 1 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor="rgba(255,255,255,0.6)" />}
          ListEmptyComponent={<CenterMessage message="처리할 신고가 없어요." />}
          renderItem={({ item }) => {
            const key = `${item.targetType}:${item.targetId}`;
            return (
              <View style={[ui.card, styles.card]}>
                <View style={styles.top}>
                  <Text style={styles.kind}>{item.board ? `${BOARD_NAME[item.board]} 글` : TARGET_NAME[item.targetType]}</Text>
                  <Text style={styles.count}>신고 {item.count}건</Text>
                </View>
                <Pressable disabled={!item.postId || !item.exists} onPress={() => router.push({ pathname: '/community-post', params: { id: String(item.postId) } })}>
                  <Text style={styles.preview} numberOfLines={3}>{item.exists ? item.preview : '이미 지워진 내용이에요'}</Text>
                </Pressable>
                <Text style={ui.meta}>작성자 {item.author.nickname ?? '(탈퇴)'} · {timeAgo(item.latestAt)}</Text>
                <Text style={styles.reasons}>{item.reasons.map(r => `${reportReasonLabel(r.code)} ${r.count}`).join(' · ')}</Text>
                {!!item.memo && <Text style={styles.memo} numberOfLines={3}>“{item.memo}”{item.moreMemos ? ` 외 ${item.moreMemos}건` : ''}</Text>}
                <View style={styles.buttons}>
                  <Pressable disabled={busy === key} onPress={() => process(item, 'dismiss')} style={({ pressed }) => [ui.secondaryButton, styles.button, pressed && { opacity: 0.7 }]}>
                    <Text style={ui.secondaryButtonText}>문제 없음</Text>
                  </Pressable>
                  <Pressable disabled={busy === key || !item.exists} onPress={() => process(item, 'take-down')}
                    style={({ pressed }) => [ui.primaryButton, styles.button, styles.danger, (pressed || !item.exists) && { opacity: 0.6 }]}>
                    <Text style={[ui.primaryButtonText, { color: 'white' }]}>내리기</Text>
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 20, paddingTop: 4, gap: 12 },
  card: { padding: 16, gap: 6 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kind: { fontFamily: 'SUIT-SemiBold', fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  count: { fontFamily: 'SUIT-Bold', fontSize: 13, color: '#FF6B4A' },
  preview: { fontFamily: 'SUIT-SemiBold', fontSize: 15, lineHeight: 22, color: 'white' },
  reasons: { fontFamily: 'SUIT-Regular', fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  memo: { fontFamily: 'SUIT-Regular', fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 8 },
  button: { flex: 1, minHeight: 44 },
  danger: { backgroundColor: '#C53030' },
});
