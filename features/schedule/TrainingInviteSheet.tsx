import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/Colors';
import PopupBackdrop from '@/components/PopupBackdrop';
import ProfileAvatar from '@/components/ProfileAvatar';
import Spinner from '@/components/Spinner';
import { useUserSearch } from '@/hooks/useSearch';
import { api } from '@/services/api';

// 트레이닝 상세 '참가자 추가' (만든 사람): 사람을 검색해 추가 요청 → 받은 사람은 푸시 · 종 알림, 상세 참석자 카드에서 승낙/거부
export default function TrainingInviteSheet({ visible, scheduleId, excludeUserIds, onClose, onInvited }: {
  visible: boolean;
  scheduleId: number;
  excludeUserIds: string[];
  onClose: () => void;
  onInvited: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const { results, searching, error, completedQuery } = useUserSearch(query, visible);
  useEffect(() => { if (!visible) setQuery(''); }, [visible]);
  const users = results.filter(u => !u.isTemporary && u.userId && !excludeUserIds.includes(u.userId));

  const invite = (user: (typeof users)[number]) => {
    Alert.alert('참가자 추가', `${user.nickname}님에게 트레이닝 참가자 추가 요청을 보낼까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '요청 보내기', onPress: async () => {
        if (busy) return;
        setBusy(true);
        try {
          await api.inviteToTraining(scheduleId, user.id);
          onInvited();
          Alert.alert('알림', `${user.nickname}님에게 추가 요청을 보냈어요.`);
        } catch (e: any) {
          if (!e._handled) Alert.alert('요청 실패', e.message ?? '잠시 후 다시 시도해주세요.');
        } finally { setBusy(false); }
      } },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <PopupBackdrop />
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="닫기" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.center} pointerEvents="box-none">
        <View style={[styles.panel, { marginLeft: 20 + insets.left, marginRight: 20 + insets.right }]}>
          <View style={styles.header}>
            <Text style={styles.title}>참가자 추가</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="닫기">
              <Ionicons name="close" size={22} color="rgba(255,255,255,0.7)" />
            </Pressable>
          </View>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color="rgba(255,255,255,0.45)" />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="닉네임 · 이름 · 전화번호로 검색"
              placeholderTextColor="rgba(255,255,255,0.3)"
              autoFocus
              returnKeyType="search"
            />
          </View>
          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {searching ? <View style={styles.message}><Spinner /></View>
              : error ? <Text style={styles.messageText}>검색하지 못했어요. 다시 시도해주세요.</Text>
              : completedQuery && users.length === 0 ? <Text style={styles.messageText}>추가할 수 있는 사람이 없어요.</Text>
              : users.map(user => (
                <Pressable key={user.id} disabled={busy} onPress={() => invite(user)} accessibilityRole="button"
                  accessibilityLabel={`${user.nickname}에게 추가 요청`}
                  style={({ pressed }) => [styles.row, (pressed || busy) && { opacity: 0.6 }]}>
                  <ProfileAvatar userId={user.userId} profileImage={user.profileImage} nickname={user.nickname} level={user.badgeLevel ?? user.level} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.name} numberOfLines={1}>{user.nickname}{user.name && user.name !== user.nickname ? ` (${user.name})` : ''}</Text>
                  </View>
                  <Text style={styles.add}>추가 요청</Text>
                </Pressable>
              ))}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center' },
  panel: { backgroundColor: Colors.brand.deep ?? '#022B4A', borderRadius: 20, padding: 20, maxHeight: '75%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title: { fontFamily: 'SUIT-Bold', fontSize: 17, color: Colors.brand.white },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  searchInput: { flex: 1, fontFamily: 'SUIT-Regular', fontSize: 15, color: Colors.brand.white, paddingVertical: 12 },
  list: { marginTop: 10, minHeight: 120 },
  message: { paddingVertical: 24, alignItems: 'center' },
  messageText: { fontFamily: 'SUIT-Regular', fontSize: 14, color: 'rgba(255,255,255,0.4)', textAlign: 'center', paddingVertical: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  name: { fontFamily: 'SUIT-SemiBold', fontSize: 15, color: Colors.brand.white },
  add: { fontFamily: 'SUIT-SemiBold', fontSize: 13, color: Colors.brand.warning },
});
