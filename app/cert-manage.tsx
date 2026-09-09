import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TextInput, StyleSheet, Pressable, FlatList, Alert,
  Modal, KeyboardAvoidingView, Platform, useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import Colors from '@/constants/Colors';
import { api, CertRequest } from '@/services/api';
import Spinner from '@/components/Spinner';

const LEVEL_OPTIONS = [
  { label: 'Level 1', value: '1' },
  { label: 'Level 2', value: '2' },
  { label: 'Level 3', value: '3' },
  { label: 'Master', value: '4' },
  { label: 'Instructor', value: '5' },
];

export default function CertManageScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [requests, setRequests] = useState<CertRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectTarget, setRejectTarget] = useState<CertRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const fetchRequests = useCallback(() => {
    setLoading(true);
    api.getCertRequests()
      .then((res) => setRequests(res.requests))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleApprove = (item: CertRequest) => {
    Alert.alert(
      '레벨 선택',
      '레벨을 선택해주세요.',
      [
        ...LEVEL_OPTIONS.map((opt) => ({
          text: opt.label,
          onPress: async () => {
            try {
              await api.approveCert(item.id, opt.value);
              Alert.alert('알림', `${item.userName}님을 ${opt.label}(으)로 승인했습니다.`);
              fetchRequests();
            } catch (e: any) {
              if (!e._handled) Alert.alert('실패', e.message ?? '잠시 후 다시 시도해주세요.');
            }
          },
        })),
        { text: '취소', style: 'cancel' },
      ]
    );
  };

  const handleReject = (item: CertRequest) => {
    setRejectTarget(item);
    setRejectReason('');
  };

  const submitReject = async () => {
    if (!rejectTarget) return;
    try {
      setRejecting(true);
      await api.rejectCert(rejectTarget.id, rejectReason.trim() || undefined);
      setRejectTarget(null);
      Alert.alert('알림', '거절 처리되었습니다.');
      fetchRequests();
    } catch (e: any) {
      if (!e._handled) Alert.alert('실패', e.message ?? '잠시 후 다시 시도해주세요.');
    } finally {
      setRejecting(false);
    }
  };

  const handleImageLongPress = async (imageUrl: string) => {
    const isExpoGo = Constants.appOwnership === 'expo';
    if (isExpoGo) {
      Alert.alert('알림', 'QR 코드 스캔은 정식 빌드에서 사용 가능합니다.');
      return;
    }
    try {
      const { BarCodeScanner } = require('expo-barcode-scanner');
      const results = await BarCodeScanner.scanFromURLAsync(imageUrl);
      if (results.length > 0) {
        const qrData = results[0].data;
        if (qrData.startsWith('http://') || qrData.startsWith('https://')) {
          Alert.alert(
            'QR 코드 감지',
            '해당 URL을 브라우저에서 열까요?',
            [
              { text: '취소', style: 'cancel' },
              { text: '열기', onPress: () => WebBrowser.openBrowserAsync(qrData) },
            ]
          );
        } else {
          Alert.alert('QR 코드 내용', qrData);
        }
      } else {
        Alert.alert('알림', 'QR 코드를 감지할 수 없습니다.');
      }
    } catch {
      Alert.alert('알림', 'QR 코드를 읽을 수 없습니다.');
    }
  };

  const imageWidth = width - 48;

  const renderItem = ({ item }: { item: CertRequest }) => (
    <View style={styles.card}>
      <Pressable onLongPress={() => handleImageLongPress(item.imageUrl)}>
        <Image
          source={{ uri: item.imageUrl }}
          style={[styles.certImage, { width: imageWidth, height: imageWidth * 0.75 }]}
          contentFit="contain"
        />
      </Pressable>
      <Text style={styles.qrHint}>이미지를 길게 누르면 QR 코드를 읽습니다</Text>

      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>이름</Text>
        <Text style={styles.infoValue}>{item.userName}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>생년월일</Text>
        <Text style={styles.infoValue}>{item.birthDate}</Text>
      </View>

      <View style={styles.actionRow}>
        <Pressable
          style={({ pressed }) => [styles.rejectButton, pressed && { opacity: 0.7 }]}
          onPress={() => handleReject(item)}
        >
          <Text style={styles.rejectText}>거절</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.approveButton, pressed && { opacity: 0.7 }]}
          onPress={() => handleApprove(item)}
        >
          <Text style={styles.approveText}>승인</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
          <Text style={styles.headerCancel}>닫기</Text>
        </Pressable>
        <Text style={styles.headerTitle}>자격증 등록 처리</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loadingArea}><Spinner /></View>
      ) : requests.length === 0 ? (
        <View style={styles.emptyArea}>
          <Text style={styles.emptyText}>처리할 요청이 없습니다.</Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          renderItem={renderItem}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Reject Reason Modal */}
      <Modal visible={!!rejectTarget} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setRejectTarget(null)} />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>거절 사유 입력</Text>
            <Text style={styles.modalSubtitle}>{rejectTarget?.userName}님의 요청을 거절합니다.</Text>

            <TextInput
              style={styles.modalInput}
              value={rejectReason}
              onChangeText={(t) => setRejectReason(t.slice(0, 100))}
              placeholder="거절 사유를 입력해주세요 (선택)"
              placeholderTextColor="rgba(255,255,255,0.3)"
              multiline
              numberOfLines={3}
              maxLength={100}
            />
            {rejectReason.length >= 100 && (
              <Text style={styles.modalLimitText}>100자 내로 입력해주세요.</Text>
            )}

            <View style={styles.modalActions}>
              <Pressable
                style={({ pressed }) => [styles.modalCancelBtn, pressed && { opacity: 0.7 }]}
                onPress={() => setRejectTarget(null)}
              >
                <Text style={styles.modalCancelText}>취소</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.modalRejectBtn, pressed && { opacity: 0.7 }]}
                onPress={submitReject}
                disabled={rejecting}
              >
                <Text style={styles.modalRejectText}>{rejecting ? '처리 중...' : '거절'}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brand.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    paddingHorizontal: 20,
  },
  headerCancel: {
    fontFamily: 'SUIT-Regular',
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
  },
  headerTitle: {
    fontFamily: 'SUIT-Bold',
    fontSize: 18,
    color: Colors.brand.white,
  },
  loadingArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: 'SUIT-Regular',
    fontSize: 16,
    color: 'rgba(255,255,255,0.4)',
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
  },
  certImage: {
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  qrHint: {
    fontFamily: 'SUIT-Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoLabel: {
    fontFamily: 'SUIT-SemiBold',
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    width: 70,
  },
  infoValue: {
    fontFamily: 'SUIT-Regular',
    fontSize: 15,
    color: Colors.brand.white,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  rejectButton: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectText: {
    fontFamily: 'SUIT-SemiBold',
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
  },
  approveButton: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: Colors.brand.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveText: {
    fontFamily: 'SUIT-Bold',
    fontSize: 15,
    color: Colors.brand.primary,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalContent: {
    width: '85%',
    backgroundColor: Colors.brand.deep,
    borderRadius: 20,
    padding: 24,
  },
  modalTitle: {
    fontFamily: 'SUIT-Bold',
    fontSize: 18,
    color: Colors.brand.white,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontFamily: 'SUIT-Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 20,
  },
  modalInput: {
    fontFamily: 'SUIT-Regular',
    fontSize: 15,
    color: Colors.brand.white,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalLimitText: {
    fontFamily: 'SUIT-Regular',
    fontSize: 12,
    color: '#FF8A8A',
    marginTop: 6,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontFamily: 'SUIT-SemiBold',
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
  },
  modalRejectBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#E53030',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalRejectText: {
    fontFamily: 'SUIT-Bold',
    fontSize: 15,
    color: Colors.brand.white,
  },
});
