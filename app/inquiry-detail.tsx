import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Colors from '@/constants/Colors';
import Spinner from '@/components/Spinner';
import { api } from '@/services/api';

type InquiryDetail = {
  id: number;
  title: string;
  content: string;
  status: 'PENDING' | 'ANSWERED';
  answer?: string;
  answeredAt?: string;
  createdAt: string;
};

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function InquiryDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [inquiry, setInquiry] = useState<InquiryDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.getInquiryDetail(Number(id))
      .then((res) => setInquiry(res.inquiry))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}>
          <View style={styles.backCircle}>
            <Text style={styles.backArrow}>{'<'}</Text>
          </View>
        </Pressable>
        <Text style={styles.headerTitle}>문의 상세</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.loadingArea}><Spinner /></View>
      ) : inquiry ? (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* 상태 + 날짜 */}
          <View style={styles.metaRow}>
            <View style={[styles.statusBadge, inquiry.status === 'ANSWERED' ? styles.statusAnswered : styles.statusPending]}>
              <Text style={[styles.statusText, inquiry.status === 'ANSWERED' ? styles.statusTextAnswered : styles.statusTextPending]}>
                {inquiry.status === 'ANSWERED' ? '답변완료' : '답변대기'}
              </Text>
            </View>
            <Text style={styles.date}>{formatDateTime(inquiry.createdAt)}</Text>
          </View>

          {/* 제목 */}
          <Text style={styles.title}>{inquiry.title}</Text>

          <View style={styles.divider} />

          {/* 내용 */}
          <Text style={styles.content}>{inquiry.content}</Text>

          {/* 답변 */}
          {inquiry.status === 'ANSWERED' && inquiry.answer && (
            <>
              <View style={styles.divider} />
              <View style={styles.answerSection}>
                <View style={styles.answerHeader}>
                  <Text style={styles.answerLabel}>답변</Text>
                  {inquiry.answeredAt && (
                    <Text style={styles.answerDate}>{formatDateTime(inquiry.answeredAt)}</Text>
                  )}
                </View>
                <Text style={styles.answerContent}>{inquiry.answer}</Text>
              </View>
            </>
          )}
        </ScrollView>
      ) : (
        <View style={styles.loadingArea}>
          <Text style={styles.emptyText}>문의를 찾을 수 없습니다.</Text>
        </View>
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
  scrollContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
  metaRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusPending: { backgroundColor: 'rgba(235,160,60,0.15)' },
  statusAnswered: { backgroundColor: 'rgba(52,199,89,0.15)' },
  statusText: { fontFamily: 'SUIT-SemiBold', fontSize: 11 },
  statusTextPending: { color: Colors.brand.warning },
  statusTextAnswered: { color: Colors.brand.success },
  date: { fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.35)' },
  title: { fontFamily: 'SUIT-Bold', fontSize: 18, color: Colors.brand.white, marginBottom: 4 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 16 },
  content: {
    fontFamily: 'SUIT-Regular', fontSize: 15, color: 'rgba(255,255,255,0.75)',
    lineHeight: 24,
  },
  answerSection: {},
  answerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10,
  },
  answerLabel: { fontFamily: 'SUIT-Bold', fontSize: 15, color: Colors.brand.success },
  answerDate: { fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.35)' },
  answerContent: {
    fontFamily: 'SUIT-Regular', fontSize: 15, color: 'rgba(255,255,255,0.75)',
    lineHeight: 24,
    backgroundColor: 'rgba(52,199,89,0.06)',
    borderRadius: 12, padding: 16,
  },
});
