import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Colors from '@/constants/Colors';
import Spinner from '@/components/Spinner';
import { api } from '@/services/api';

type Inquiry = {
  id: number;
  title: string;
  content: string;
  status: 'PENDING' | 'ANSWERED';
  createdAt: string;
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export default function InquiryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      api.getInquiries()
        .then((res) => setInquiries(res.inquiries ?? []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [])
  );

  const renderItem = ({ item }: { item: Inquiry }) => (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
      onPress={() => router.push({ pathname: '/inquiry-detail', params: { id: String(item.id) } })}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.statusBadge, item.status === 'ANSWERED' ? styles.statusAnswered : styles.statusPending]}>
          <Text style={[styles.statusText, item.status === 'ANSWERED' ? styles.statusTextAnswered : styles.statusTextPending]}>
            {item.status === 'ANSWERED' ? '답변완료' : '답변대기'}
          </Text>
        </View>
        <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
      </View>
      <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
      <Text style={styles.content} numberOfLines={1}>{item.content}</Text>
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
        <Text style={styles.headerTitle}>문의하기</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.loadingArea}><Spinner /></View>
      ) : (
        <FlatList
          data={inquiries}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.emptyArea}>
              <Text style={styles.emptyText}>문의 내역이 없습니다.</Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <View style={styles.bottomArea}>
        <Pressable
          style={({ pressed }) => [styles.addButton, pressed && { opacity: 0.85 }]}
          onPress={() => router.push('/inquiry-write')}
        >
          <Text style={styles.addButtonText}>문의하기</Text>
        </Pressable>
      </View>
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
  listContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 80 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12, padding: 16, marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  statusPending: { backgroundColor: 'rgba(235,160,60,0.15)' },
  statusAnswered: { backgroundColor: 'rgba(52,199,89,0.15)' },
  statusText: { fontFamily: 'SUIT-SemiBold', fontSize: 11 },
  statusTextPending: { color: Colors.brand.warning },
  statusTextAnswered: { color: Colors.brand.success },
  date: { fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.35)' },
  title: { fontFamily: 'SUIT-SemiBold', fontSize: 15, color: Colors.brand.white, marginBottom: 4 },
  content: { fontFamily: 'SUIT-Regular', fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  emptyArea: { alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText: { fontFamily: 'SUIT-Regular', fontSize: 14, color: 'rgba(255,255,255,0.3)' },
  bottomArea: { paddingHorizontal: 20, paddingVertical: 12 },
  addButton: {
    height: 54, borderRadius: 14,
    backgroundColor: Colors.brand.white,
    alignItems: 'center', justifyContent: 'center',
  },
  addButtonText: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.primary },
});
