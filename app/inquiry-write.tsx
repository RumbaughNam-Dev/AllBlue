import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Pressable, Alert,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  ScrollView, Image, useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import Colors from '@/constants/Colors';
import { api } from '@/services/api';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

type Attachment = {
  uri: string;
  name: string;
  type: string;
  size?: number;
};

export default function InquiryWriteScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { height: windowHeight } = useWindowDimensions();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [saving, setSaving] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '사진 라이브러리 접근 권한이 필요합니다.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });
    if (result.canceled || !result.assets || !result.assets[0]) return;

    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > MAX_FILE_SIZE) {
      Alert.alert('알림', '파일 크기는 10MB까지 가능합니다.');
      return;
    }
    const filename = asset.fileName || asset.uri.split('/').pop() || 'image.jpg';
    const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
    setAttachment({ uri: asset.uri, name: filename, type: `image/${ext}`, size: asset.fileSize });
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      multiple: false,
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets || !result.assets[0]) return;

    const asset = result.assets[0];
    if (asset.size && asset.size > MAX_FILE_SIZE) {
      Alert.alert('알림', '파일 크기는 10MB까지 가능합니다.');
      return;
    }
    setAttachment({
      uri: asset.uri,
      name: asset.name,
      type: asset.mimeType || 'application/octet-stream',
      size: asset.size,
    });
  };

  const removeAttachment = () => setAttachment(null);

  const showAttachMenu = () => {
    Alert.alert('파일 첨부', '첨부 방법을 선택해주세요.', [
      { text: '사진 선택', onPress: pickImage },
      { text: '파일 선택', onPress: pickDocument },
      { text: '취소', style: 'cancel' },
    ]);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('알림', '제목을 입력해주세요.');
      return;
    }
    if (!content.trim()) {
      Alert.alert('알림', '내용을 입력해주세요.');
      return;
    }
    setSaving(true);
    try {
      await api.createInquiry(title.trim(), content.trim(), attachment || undefined);
      Alert.alert('알림', '문의가 등록되었습니다.', [
        { text: '확인', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      if (!e._handled) Alert.alert('오류', '문의 등록에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const isImage = (type: string) => type.startsWith('image/');

  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const headerHeight = 52 + insets.top;
  const bottomHeight = 78 + insets.bottom;
  const availableHeight = windowHeight - headerHeight - bottomHeight;

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}>
          <View style={styles.backCircle}>
            <Text style={styles.backArrow}>{'<'}</Text>
          </View>
        </Pressable>
        <Text style={styles.headerTitle}>문의 작성</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.scrollContent, { minHeight: availableHeight }]}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <Text style={styles.label}>제목</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="제목을 입력해주세요"
            placeholderTextColor="rgba(255,255,255,0.25)"
            maxLength={100}
          />

          <Text style={styles.label}>내용</Text>
          <TextInput
            style={[styles.textArea, { minHeight: 120 }]}
            value={content}
            onChangeText={setContent}
            placeholder="문의 내용을 입력해주세요"
            placeholderTextColor="rgba(255,255,255,0.25)"
            multiline
            textAlignVertical="top"
            maxLength={2000}
          />

          <View style={styles.attachSection}>
            <Text style={styles.label}>첨부파일</Text>

            {attachment ? (
              <View style={styles.attachItem}>
                {isImage(attachment.type) ? (
                  <Image source={{ uri: attachment.uri }} style={styles.attachThumb} />
                ) : (
                  <View style={styles.attachFileIcon}>
                    <Text style={styles.attachFileIconText}>F</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.attachName} numberOfLines={1}>{attachment.name}</Text>
                  {attachment.size ? <Text style={styles.attachSize}>{formatSize(attachment.size)}</Text> : null}
                </View>
                <Pressable
                  onPress={removeAttachment}
                  style={({ pressed }) => [styles.attachRemove, pressed && { opacity: 0.6 }]}
                >
                  <Text style={styles.attachRemoveText}>X</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={({ pressed }) => [styles.attachButton, pressed && { opacity: 0.7 }]}
                onPress={showAttachMenu}
              >
                <Text style={styles.attachButtonIcon}>+</Text>
                <Text style={styles.attachButtonText}>사진 또는 파일 첨부 (최대 10MB)</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>

        <View style={styles.bottomArea}>
          <Pressable
            style={({ pressed }) => [styles.submitButton, pressed && { opacity: 0.85 }, saving && { opacity: 0.5 }]}
            onPress={handleSubmit}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={Colors.brand.primary} />
            ) : (
              <Text style={styles.submitText}>등록</Text>
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
  scrollContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  label: {
    fontFamily: 'SUIT-SemiBold', fontSize: 14, color: Colors.brand.white,
    marginBottom: 8, marginTop: 12,
  },
  input: {
    fontFamily: 'SUIT-Regular', fontSize: 16, color: Colors.brand.white,
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  textArea: {
    fontFamily: 'SUIT-Regular', fontSize: 15, color: Colors.brand.white,
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    flex: 1,
  },
  attachSection: { marginTop: 16 },
  attachButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderStyle: 'dashed',
    paddingVertical: 14, gap: 8,
  },
  attachButtonIcon: {
    fontFamily: 'SUIT-Bold', fontSize: 20, color: 'rgba(255,255,255,0.5)',
  },
  attachButtonText: {
    fontFamily: 'SUIT-Medium', fontSize: 14, color: 'rgba(255,255,255,0.5)',
  },
  attachItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8, gap: 10,
  },
  attachThumb: { width: 44, height: 44, borderRadius: 6 },
  attachFileIcon: {
    width: 44, height: 44, borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  attachFileIconText: { fontFamily: 'SUIT-Bold', fontSize: 16, color: 'rgba(255,255,255,0.5)' },
  attachName: {
    fontFamily: 'SUIT-Regular', fontSize: 13, color: Colors.brand.white,
  },
  attachSize: {
    fontFamily: 'SUIT-Regular', fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2,
  },
  attachRemove: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  attachRemoveText: { fontFamily: 'SUIT-Bold', fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  bottomArea: { paddingHorizontal: 24, paddingVertical: 12 },
  submitButton: {
    height: 54, borderRadius: 14,
    backgroundColor: Colors.brand.white,
    alignItems: 'center', justifyContent: 'center',
  },
  submitText: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.primary },
});
