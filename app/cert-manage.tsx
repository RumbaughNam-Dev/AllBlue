import PopupBackdrop from '@/components/PopupBackdrop';
import ProfileLink from '@/components/ProfileLink';
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
import { api, CertRequest, CertificationOption } from '@/services/api';
import Spinner from '@/components/Spinner';

export default function CertManageScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [requests, setRequests] = useState<CertRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectTarget, setRejectTarget] = useState<CertRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [approveTarget, setApproveTarget] = useState<CertRequest | null>(null);
  const [licenseOptions, setLicenseOptions] = useState<CertificationOption[]>([]);
  const [selectedLicense, setSelectedLicense] = useState<CertificationOption | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState(false);
  const [approving, setApproving] = useState(false);

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

  const handleApprove = async (item: CertRequest) => {
    setApproveTarget(item);
    setSelectedLicense(null);
    setLicenseOptions([]);
    setOptionsLoading(true);
    setOptionsError(false);
    try {
      const result = await api.getCertificationOptions();
      setLicenseOptions(result.data);
    } catch {
      setOptionsError(true);
    } finally {
      setOptionsLoading(false);
    }
  };

  const submitApprove = async () => {
    if (!approveTarget || !selectedLicense || approving) return;
    setApproving(true);
    try {
      await api.approveCert(approveTarget.id, selectedLicense.id);
      setApproveTarget(null);
      Alert.alert('승인 완료', `${approveTarget.userName}님의 ${selectedLicense.nameKo || selectedLicense.name} 자격증을 등록했습니다.`);
      fetchRequests();
    } catch (e: any) {
      if (!e._handled) Alert.alert('실패', e.message ?? '잠시 후 다시 시도해주세요.');
    } finally {
      setApproving(false);
    }
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
        <ProfileLink userId={item.userId} label={item.userName}><Text style={styles.infoValue}>{item.userName}</Text></ProfileLink>
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

      <Modal visible={!!approveTarget} transparent animationType="fade"
        onRequestClose={() => { if (!approving) setApproveTarget(null); }}>
        <View style={styles.modalOverlay}>
          <PopupBackdrop />
          <Pressable style={styles.modalBackdrop} disabled={approving} onPress={() => setApproveTarget(null)} />
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>취득 자격증 선택</Text>
            <Text style={styles.modalSubtitle}>{approveTarget?.userName}님의 증빙과 일치하는 자격증을 선택해주세요.</Text>
            {optionsLoading ? <Spinner /> : optionsError ? (
              <Pressable onPress={() => approveTarget && handleApprove(approveTarget)}>
                <Text style={styles.modalSubtitle}>목록을 불러오지 못했습니다. 다시 시도</Text>
              </Pressable>
            ) : (
              <FlatList
                style={{ flexGrow: 0 }}
                data={licenseOptions}
                keyExtractor={(item) => String(item.id)}
                ListEmptyComponent={<Text style={styles.modalSubtitle}>등록된 자격증이 없습니다.</Text>}
                renderItem={({ item }) => (
                  <Pressable disabled={approving} accessibilityRole="radio"
                    accessibilityState={{ selected: selectedLicense?.id === item.id }}
                    onPress={() => setSelectedLicense(item)}
                    style={[styles.licenseOption, selectedLicense?.id === item.id && styles.licenseSelected]}>
                    <Text style={styles.licenseAssociation}>{item.association.nameKo || item.association.name}</Text>
                    <Text style={styles.licenseName}>{item.nameKo || item.name}</Text>
                  </Pressable>
                )}
              />
            )}
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelBtn} disabled={approving} onPress={() => setApproveTarget(null)}>
                <Text style={styles.modalCancelText}>취소</Text>
              </Pressable>
              <Pressable style={[styles.approveButton, { opacity: selectedLicense && !approving ? 1 : 0.4 }]}
                disabled={!selectedLicense || approving} onPress={submitApprove}>
                <Text style={styles.approveText}>{approving ? '처리 중...' : '자격증 승인'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reject Reason Modal */}
      <Modal visible={!!rejectTarget} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <PopupBackdrop />
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
  licenseOption: { padding: 12, marginBottom: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  licenseSelected: { borderColor: '#00C9ED', backgroundColor: 'rgba(0,201,237,0.12)' },
  licenseAssociation: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 4 },
  licenseName: { color: '#fff', fontFamily: 'SUIT-Medium', fontSize: 15 },
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
    ...StyleSheet.absoluteFill,
    backgroundColor: 'transparent',
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
