import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Pressable, Alert,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  ScrollView, Linking, Keyboard,
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

export default function InquiryAnswerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [inquiry, setInquiry] = useState<InquiryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [answer, setAnswer] = useState('');
  const [saving, setSaving] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.getInquiryDetail(Number(id))
      .then((res) => {
        setInquiry(res.inquiry);
        if (res.inquiry.answer) setAnswer(res.inquiry.answer);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    if (!answer.trim()) {
      Alert.alert('알림', '답변을 입력해주세요.');
      return;
    }
    setSaving(true);
    try {
      await api.answerInquiry(Number(id), answer.trim());
      Alert.alert('알림', '답변이 저장되었습니다.', [
        { text: '확인', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      if (!e._handled) Alert.alert('오류', '답변 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    if (!inquiry?.attachment) return;
    try {
      await Linking.openURL(inquiry.attachment.fileUrl);
    } catch {
      Alert.alert('오류', '파일을 열 수 없습니다.');
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar style="light" />
        <View style={styles.loadingArea}><Spinner /></View>
      </View>
    );
  }

  if (!inquiry) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}>
            <View style={styles.backCircle}>
              <Text style={styles.backArrow}>{'<'}</Text>
            </View>
          </Pressable>
          <Text style={styles.headerTitle}>답변하기</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.loadingArea}>
          <Text style={styles.emptyText}>문의를 찾을 수 없습니다.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <View style={{ width: 36 }} />
        <Text style={styles.headerTitle}>답변하기</Text>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.closeButton, pressed && { opacity: 0.6 }]}>
          <View style={styles.closeCircle}>
            <Text style={styles.closeX}>✕</Text>
          </View>
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          bounces={false}
        >
          {/* 상단 50%: 답변 입력 */}
          <View style={styles.topHalf}>
            <Text style={styles.sectionLabel}>답변 내용</Text>
            <TextInput
              style={styles.answerInput}
              value={answer}
              onChangeText={setAnswer}
              placeholder="답변을 입력해주세요"
              placeholderTextColor="rgba(255,255,255,0.25)"
              multiline
              textAlignVertical="top"
              maxLength={5000}
            />
          </View>

          {/* 문의 내용 보기 토글 */}
          <View style={styles.toggleRow}>
            <Pressable
              onPress={() => setShowOriginal(!showOriginal)}
              style={({ pressed }) => [pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.toggleText}>
                {showOriginal ? '문의 내용 닫기' : '문의 내용 보기'}
                {' '}{showOriginal ? '▲' : '▼'}
              </Text>
            </Pressable>
            <Text style={styles.dateText}>{formatDateTime(inquiry.createdAt)}</Text>
          </View>

          {/* 하단 50%: 문의 원문 */}
          {showOriginal && (
            <View style={styles.bottomHalf}>
              <Text style={styles.originalTitle}>{inquiry.title}</Text>
              <View style={styles.divider} />
              <Text style={styles.originalContent}>{inquiry.content}</Text>

              {inquiry.attachment && (
                <Pressable
                  style={({ pressed }) => [styles.fileDownload, pressed && { opacity: 0.7 }]}
                  onPress={handleDownload}
                >
                  <View style={styles.fileIcon}>
                    <Text style={styles.fileIconText}>
                      {inquiry.attachment.mimeType.startsWith('image/') ? 'IMG' : 'F'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fileName} numberOfLines={1}>{inquiry.attachment.fileName}</Text>
                    <Text style={styles.fileSize}>{formatSize(inquiry.attachment.fileSize)}</Text>
                  </View>
                  <Text style={styles.downloadText}>다운로드</Text>
                </Pressable>
              )}
            </View>
          )}
        </ScrollView>

        {/* 하단 버튼 */}
        <View style={styles.bottomArea}>
          <Pressable
            style={({ pressed }) => [styles.submitButton, pressed && { opacity: 0.85 }, saving && { opacity: 0.5 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={Colors.brand.primary} />
            ) : (
              <Text style={styles.submitText}>답변 저장</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.brand.primary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    height: 52, paddingHorizontal: 20, marginTop: 20,
  },
  closeButton: { width: 36, height: 36 },
  closeCircle: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeX: { fontFamily: 'SUIT-Bold', fontSize: 14, color: Colors.brand.white },
  headerTitle: { fontFamily: 'SUIT-Bold', fontSize: 18, color: Colors.brand.white },
  loadingArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: 'SUIT-Regular', fontSize: 15, color: 'rgba(255,255,255,0.35)' },

  topHalf: { flex: 1, paddingHorizontal: 24, paddingTop: 8 },
  sectionLabel: {
    fontFamily: 'SUIT-SemiBold', fontSize: 14, color: Colors.brand.white,
    marginBottom: 8,
  },
  answerInput: {
    flex: 1,
    fontFamily: 'SUIT-Regular', fontSize: 15, color: Colors.brand.white,
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
  },
  toggleText: {
    fontFamily: 'SUIT-SemiBold', fontSize: 14, color: Colors.brand.warning,
  },
  dateText: {
    fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.35)',
  },

  bottomHalf: {
    flex: 1, paddingHorizontal: 24,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 12,
  },
  originalTitle: {
    fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.white,
    marginBottom: 4,
  },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 10 },
  originalContent: {
    fontFamily: 'SUIT-Regular', fontSize: 14, color: 'rgba(255,255,255,0.7)',
    lineHeight: 22,
  },
  fileDownload: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, gap: 10,
    marginTop: 12,
  },
  fileIcon: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  fileIconText: { fontFamily: 'SUIT-Bold', fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  fileName: { fontFamily: 'SUIT-Medium', fontSize: 13, color: Colors.brand.white },
  fileSize: { fontFamily: 'SUIT-Regular', fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 },
  downloadText: { fontFamily: 'SUIT-SemiBold', fontSize: 13, color: Colors.brand.warning },

  bottomArea: { paddingHorizontal: 24, paddingVertical: 12 },
  submitButton: {
    height: 54, borderRadius: 14,
    backgroundColor: Colors.brand.white,
    alignItems: 'center', justifyContent: 'center',
  },
  submitText: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.primary },
});
