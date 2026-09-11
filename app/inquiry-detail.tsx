import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Image, useWindowDimensions, Linking, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Colors from '@/constants/Colors';
import Spinner from '@/components/Spinner';
import { api } from '@/services/api';

type AttachmentInfo = {
  id: number;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
};

type InquiryDetail = {
  id: number;
  title: string;
  content: string;
  status: 'PENDING' | 'ANSWERED';
  answer?: string;
  answeredAt?: string;
  createdAt: string;
  attachment?: AttachmentInfo;
};

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export default function InquiryDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
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

  const isImageAttachment = inquiry?.attachment?.mimeType?.startsWith('image/');

  const handleDownload = async () => {
    if (!inquiry?.attachment) return;
    try {
      await Linking.openURL(inquiry.attachment.fileUrl);
    } catch {
      Alert.alert('오류', '파일을 열 수 없습니다.');
    }
  };

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
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* 사진 첨부: 상단 큰 이미지 */}
          {inquiry.attachment && isImageAttachment && (
            <Image
              source={{ uri: inquiry.attachment.fileUrl }}
              style={[styles.heroImage, { width: screenWidth, height: screenWidth * 0.65 }]}
              resizeMode="cover"
            />
          )}

          <View style={styles.scrollContent}>
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

            {/* 파일 첨부: 다운로드 버튼 */}
            {inquiry.attachment && !isImageAttachment && (
              <Pressable
                style={({ pressed }) => [styles.fileDownload, pressed && { opacity: 0.7 }]}
                onPress={handleDownload}
              >
                <View style={styles.fileIcon}>
                  <Text style={styles.fileIconText}>F</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fileName} numberOfLines={1}>{inquiry.attachment.fileName}</Text>
                  <Text style={styles.fileSize}>{formatSize(inquiry.attachment.fileSize)}</Text>
                </View>
                <Text style={styles.downloadText}>다운로드</Text>
              </Pressable>
            )}

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
          </View>
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
  heroImage: { backgroundColor: 'rgba(0,0,0,0.2)' },
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
  fileDownload: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, gap: 10,
    marginTop: 16,
  },
  fileIcon: {
    width: 40, height: 40, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  fileIconText: { fontFamily: 'SUIT-Bold', fontSize: 16, color: 'rgba(255,255,255,0.5)' },
  fileName: { fontFamily: 'SUIT-Medium', fontSize: 13, color: Colors.brand.white },
  fileSize: { fontFamily: 'SUIT-Regular', fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 },
  downloadText: { fontFamily: 'SUIT-SemiBold', fontSize: 13, color: Colors.brand.warning },
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
