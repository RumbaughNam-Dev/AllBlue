import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Colors from '@/constants/Colors';
import LevelBadge from '@/components/LevelBadge';
import Spinner from '@/components/Spinner';
import { api } from '@/services/api';

type BlockedUser = {
  userId: string;
  nickname: string;
  name?: string;
  level?: string | number | null;
  memo?: string;
  phone?: string;
  email?: string;
};

function maskPhone(p?: string): string {
  if (!p) return '';
  const d = p.replace(/\D/g, '');
  if (d.length === 11) return `${d.slice(0, 3)}-****-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-***-${d.slice(6)}`;
  return p;
}

function maskEmail(e?: string): string {
  if (!e) return '';
  const [local, domain] = e.split('@');
  if (!domain) return e;
  const masked = local.length <= 2 ? local : local.slice(0, 2) + '***';
  return `${masked}@${domain}`;
}

export default function BlockedUsersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    api.getBlockedUsers()
      .then((res) => setUsers(res.users ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const handleUnblock = (user: BlockedUser) => {
    Alert.alert('차단 해제', `${user.nickname}님의 차단을 해제할까요?`, [
      { text: '취소' },
      { text: '해제', onPress: async () => {
        try {
          await api.unblockUser(user.userId);
          setUsers((prev) => prev.filter((u) => u.userId !== user.userId));
        } catch {
          Alert.alert('오류', '차단 해제에 실패했습니다.');
        }
      }},
    ]);
  };

  const getSubText = (user: BlockedUser): string => {
    if (user.memo) return user.memo;
    if (user.phone) return maskPhone(user.phone);
    if (user.email) return maskEmail(user.email);
    return '';
  };

  const renderItem = ({ item }: { item: BlockedUser }) => (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
      onPress={() => handleUnblock(item)}
    >
      <View style={styles.cardInfo}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>
            {item.nickname}{item.name ? ` (${item.name})` : ''}
          </Text>
          <LevelBadge level={item.level} size={18} />
        </View>
        {getSubText(item) ? (
          <Text style={styles.sub} numberOfLines={1}>{getSubText(item)}</Text>
        ) : null}
      </View>
      <Text style={styles.unblockText}>해제</Text>
    </Pressable>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}>
          <View style={styles.backCircle}>
            <Text style={styles.backArrow}>{'<'}</Text>
          </View>
        </Pressable>
        <Text style={styles.headerTitle}>차단 관리</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.loadingArea}><Spinner /></View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.userId}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.emptyArea}>
              <Text style={styles.emptyText}>차단한 유저가 없습니다.</Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.brand.primary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    height: 52, paddingHorizontal: 20,
  },
  backButton: { width: 36, height: 36 },
  backCircle: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  backArrow: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.white, marginRight: 1 },
  headerTitle: { fontFamily: 'SUIT-Bold', fontSize: 18, color: Colors.brand.white },
  loadingArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12, padding: 14, marginBottom: 8,
  },
  cardInfo: { flex: 1 },
  nameRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4,
  },
  name: { fontFamily: 'SUIT-SemiBold', fontSize: 15, color: Colors.brand.white },
  sub: { fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  unblockText: {
    fontFamily: 'SUIT-SemiBold', fontSize: 13, color: '#FF6B6B', marginLeft: 12,
  },
  emptyArea: { alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText: { fontFamily: 'SUIT-Regular', fontSize: 14, color: 'rgba(255,255,255,0.3)' },
});
