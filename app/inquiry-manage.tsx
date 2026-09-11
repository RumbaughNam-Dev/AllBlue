import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Colors from '@/constants/Colors';
import Spinner from '@/components/Spinner';
import { api } from '@/services/api';

type InquiryItem = {
  id: number;
  userId: string;
  userName: string;
  title: string;
  status: 'PENDING' | 'ANSWERED';
  createdAt: string;
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export default function InquiryManageScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [inquiries, setInquiries] = useState<InquiryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      api.getAllInquiries()
        .then((res) => setInquiries(res.inquiries))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [])
  );

  const renderItem = ({ item }: { item: InquiryItem }) => (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
      onPress={() => router.push(`/inquiry-answer?id=${item.id}`)}
    >
      <View style={styles.cardTop}>
        <View style={[styles.statusBadge, item.status === 'ANSWERED' ? styles.statusAnswered : styles.statusPending]}>
          <Text style={[styles.statusText, item.status === 'ANSWERED' ? styles.statusTextAnswered : styles.statusTextPending]}>
            {item.status === 'ANSWERED' ? '답변완료' : '답변대기'}
          </Text>
        </View>
        <Text style={styles.cardDate}>{formatDate(item.createdAt)}</Text>
      </View>
      <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
      <Text style={styles.cardUser}>{item.userName} ({item.userId})</Text>
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
        <Text style={styles.headerTitle}>문의 요청 처리</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.loadingArea}><Spinner /></View>
      ) : inquiries.length === 0 ? (
        <View style={styles.loadingArea}>
          <Text style={styles.emptyText}>문의가 없습니다.</Text>
        </View>
      ) : (
        <FlatList
          data={inquiries}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
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
  emptyText: { fontFamily: 'SUIT-Regular', fontSize: 15, color: 'rgba(255,255,255,0.35)' },
  listContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14,
    padding: 16, marginBottom: 10,
  },
  cardTop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusPending: { backgroundColor: 'rgba(235,160,60,0.15)' },
  statusAnswered: { backgroundColor: 'rgba(52,199,89,0.15)' },
  statusText: { fontFamily: 'SUIT-SemiBold', fontSize: 11 },
  statusTextPending: { color: Colors.brand.warning },
  statusTextAnswered: { color: Colors.brand.success },
  cardDate: { fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.35)' },
  cardTitle: { fontFamily: 'SUIT-SemiBold', fontSize: 15, color: Colors.brand.white, marginBottom: 4 },
  cardUser: { fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.4)' },
});
