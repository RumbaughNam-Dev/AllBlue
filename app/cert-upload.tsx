import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Image, Alert,
  Platform, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import Colors from '@/constants/Colors';
import { api } from '@/services/api';

export default function CertUploadScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [rejectReason, setRejectReason] = useState<string | null>(null);

  React.useEffect(() => {
    api.getLastCertReject()
      .then((res) => {
        if (res.rejected) setRejectReason(res.reason ?? '사유 없음');
      })
      .catch(() => {});
  }, []);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '사진 라이브러리 접근 권한이 필요합니다.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!imageUri) {
      Alert.alert('알림', '자격증 사진을 선택해주세요.');
      return;
    }

    Alert.alert(
      '자격증 인증 요청',
      '업로드한 사진으로 자격증 인증을 요청합니다.\n진행하시겠어요?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '요청',
          onPress: async () => {
            try {
              setUploading(true);
              await api.uploadCertImage(imageUri);
              Alert.alert(
                '요청 완료',
                '자격증 인증 요청이 접수되었습니다.\n관리자 확인 후 레벨이 변경됩니다.',
                [{ text: '확인', onPress: () => router.back() }],
              );
            } catch (e: any) {
              if (!e._handled) {
                Alert.alert('요청 실패', e.message ?? '잠시 후 다시 시도해주세요.');
              }
            } finally {
              setUploading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
          <Text style={styles.headerCancel}>취소</Text>
        </Pressable>
        <Text style={styles.headerTitle}>자격증 등록 요청</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        {/* Reject Notice */}
        {rejectReason && (
          <View style={styles.rejectBanner}>
            <View style={styles.rejectIcon}>
              <Text style={styles.rejectIconText}>!</Text>
            </View>
            <Text style={styles.rejectText}>
              지난 자격증 등록 요청 건은 <Text style={styles.rejectReason}>{rejectReason}</Text> 사유로 거절되었습니다.
            </Text>
          </View>
        )}

        {/* Title & Description */}
        <Text style={styles.title}>자격증 사진 업로드</Text>
        <Text style={styles.description}>QR코드가 잘 보이도록 업로드 해 주세요.</Text>

        {/* Image Area */}
        <Pressable onPress={pickImage} style={({ pressed }) => [styles.imageArea, pressed && { opacity: 0.8 }]}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="contain" />
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderIcon}>+</Text>
              <Text style={styles.placeholderText}>사진 선택</Text>
            </View>
          )}
        </Pressable>

        {imageUri && (
          <Pressable onPress={pickImage} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
            <Text style={styles.changeText}>다른 사진 선택</Text>
          </Pressable>
        )}
      </View>

      {/* Submit Button */}
      <View style={styles.bottomArea}>
        <Pressable
          style={({ pressed }) => [
            styles.submitButton,
            !imageUri && styles.submitButtonDisabled,
            pressed && styles.submitButtonPressed,
          ]}
          onPress={handleSubmit}
          disabled={uploading || !imageUri}
        >
          {uploading ? (
            <ActivityIndicator color={Colors.brand.primary} />
          ) : (
            <Text style={styles.submitText}>인증 요청</Text>
          )}
        </Pressable>
      </View>
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
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  rejectBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,120,120,0.15)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    gap: 10,
  },
  rejectIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FF8A8A',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  rejectIconText: {
    fontFamily: 'SUIT-Bold',
    fontSize: 14,
    color: Colors.brand.white,
  },
  rejectText: {
    flex: 1,
    fontFamily: 'SUIT-Regular',
    fontSize: 13,
    color: '#FF8A8A',
    lineHeight: 20,
  },
  rejectReason: {
    fontFamily: 'SUIT-Bold',
  },
  title: {
    fontFamily: 'SUIT-Bold',
    fontSize: 22,
    color: Colors.brand.white,
    marginBottom: 8,
  },
  description: {
    fontFamily: 'SUIT-Regular',
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 28,
  },
  imageArea: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  placeholderIcon: {
    fontSize: 36,
    color: 'rgba(255,255,255,0.25)',
  },
  placeholderText: {
    fontFamily: 'SUIT-Regular',
    fontSize: 14,
    color: 'rgba(255,255,255,0.3)',
  },
  changeText: {
    fontFamily: 'SUIT-SemiBold',
    fontSize: 14,
    color: '#00E5FF',
    textAlign: 'center',
    marginTop: 16,
  },
  bottomArea: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'android' ? 12 : 0,
  },
  submitButton: {
    height: 54,
    borderRadius: 14,
    backgroundColor: Colors.brand.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  submitText: {
    fontFamily: 'SUIT-Bold',
    fontSize: 16,
    color: Colors.brand.primary,
  },
});
