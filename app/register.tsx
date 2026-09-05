import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Colors from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';

export default function RegisterScreen() {
  const { tempToken, nickname } = useLocalSearchParams<{
    tempToken: string;
    nickname?: string;
    profileImage?: string;
  }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login } = useAuth();

  const [nicknameTxt, setNicknameTxt] = useState(nickname ?? '');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');
  const [kakaoTalkId, setKakaoTalkId] = useState('');
  const [instagramId, setInstagramId] = useState('');
  const [loading, setLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const formatBirthDate = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 4) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
  };

  const formatPhone = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  };

  const hasContact = phone.trim() || kakaoTalkId.trim() || instagramId.trim();

  const hasInput = nicknameTxt.trim() !== (nickname ?? '') || birthDate || phone.trim() || kakaoTalkId.trim() || instagramId.trim();

  const isValidBirthDate = () => {
    const digits = birthDate.replace(/\D/g, '');
    if (digits.length !== 8) return false;
    const year = parseInt(digits.slice(0, 4));
    const month = parseInt(digits.slice(4, 6));
    const day = parseInt(digits.slice(6, 8));
    if (year < 1900 || year > new Date().getFullYear()) return false;
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  };

  const isValidPhone = () => {
    if (!phone.trim()) return true;
    const digits = phone.replace(/\D/g, '');
    return digits.length === 10 || digits.length === 11;
  };

  const canSubmit = nicknameTxt.trim() && isValidBirthDate() && hasContact && isValidPhone();

  const confirmGoBack = useCallback(() => {
    if (hasInput) {
      Alert.alert(
        '확인',
        '입력한 데이터가 초기화 되요.\n돌아가시겠어요?',
        [
          { text: '아니오', style: 'cancel' },
          { text: '네', onPress: () => router.replace('/login') },
        ]
      );
    } else {
      router.replace('/login');
    }
  }, [hasInput, router]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      confirmGoBack();
      return true;
    });
    return () => backHandler.remove();
  }, [confirmGoBack]);

  const handleSubmit = async () => {
    if (!nicknameTxt.trim()) {
      Alert.alert('입력 확인', '닉네임을 입력해주세요.');
      return;
    }
    if (!isValidBirthDate()) {
      Alert.alert('입력 확인', '생년월일을 정확히 입력해주세요.\n예: 1995-03-15');
      return;
    }
    if (!hasContact) {
      Alert.alert('입력 확인', '전화번호, 카카오톡 ID, 인스타 ID 중\n최소 1개를 입력해주세요.');
      return;
    }
    if (!isValidPhone()) {
      Alert.alert('입력 확인', '전화번호 형식이 올바르지 않습니다.\n예: 010-1234-5678');
      return;
    }

    try {
      setLoading(true);
      const res = await api.register(tempToken!, {
        nickname: nicknameTxt.trim(),
        birthDate,
        ...(phone.trim() ? { phone: phone.replace(/\D/g, '') } : {}),
        ...(kakaoTalkId.trim() ? { kakaoTalkId: kakaoTalkId.trim() } : {}),
        ...(instagramId.trim() ? { instagramId: instagramId.trim() } : {}),
      });
      await login(res.token, res.user);
      Alert.alert(
        '가입 완료',
        `${res.user.nickname}님, 환영합니다!\nAllBlue와 함께 안전한 다이빙 되세요.`,
      );
    } catch (e: any) {
      Alert.alert('가입 실패', e.message ?? '잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            <Text style={styles.title}>회원 정보 입력</Text>
            <Text style={styles.description}>
              서비스 이용을 위해{'\n'}기본 정보를 입력해주세요.
            </Text>

            {/* 필수 정보 */}
            <Text style={styles.sectionLabel}>필수 정보</Text>
            <Text style={styles.sectionDescription}>
              자격증 인증 정보를 확인하기 위해 필요합니다.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>닉네임</Text>
              <TextInput
                style={styles.input}
                value={nicknameTxt}
                onChangeText={setNicknameTxt}
                placeholder="닉네임을 입력해주세요"
                placeholderTextColor="rgba(255,255,255,0.25)"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>생년월일</Text>
              <TextInput
                style={styles.input}
                value={birthDate}
                onChangeText={(t) => setBirthDate(formatBirthDate(t))}
                placeholder="1995-03-15"
                placeholderTextColor="rgba(255,255,255,0.25)"
                keyboardType="number-pad"
                maxLength={10}
              />
            </View>

            {/* 연락처 정보 */}
            <View style={styles.sectionRow}>
              <Text style={styles.sectionLabel}>연락처 정보</Text>
              <Text style={styles.sectionHint}>1개 이상 필수</Text>
            </View>
            <Text style={styles.sectionDescription}>
              시스템 이용상 문제가 발생할 경우 공지할 연락처가 최소 1개 이상 필요합니다.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>전화번호</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={(t) => setPhone(formatPhone(t))}
                placeholder="010-0000-0000"
                placeholderTextColor="rgba(255,255,255,0.25)"
                keyboardType="phone-pad"
                maxLength={13}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>카카오톡 ID</Text>
              <TextInput
                style={styles.input}
                value={kakaoTalkId}
                onChangeText={setKakaoTalkId}
                placeholder="카카오톡 ID"
                placeholderTextColor="rgba(255,255,255,0.25)"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>인스타그램 ID</Text>
              <TextInput
                style={styles.input}
                value={instagramId}
                onChangeText={setInstagramId}
                placeholder="@없이 입력"
                placeholderTextColor="rgba(255,255,255,0.25)"
                autoCapitalize="none"
              />
            </View>
          </Animated.View>
        </ScrollView>

        <View style={styles.bottomArea}>
          <Pressable
            style={({ pressed }) => [
              styles.submitButton,
              !canSubmit && styles.submitButtonDisabled,
              pressed && styles.submitButtonPressed,
            ]}
            onPress={handleSubmit}
            disabled={loading || !canSubmit}
          >
            {loading ? (
              <ActivityIndicator color={Colors.brand.primary} />
            ) : (
              <Text style={styles.submitText}>가입 완료</Text>
            )}
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}
            onPress={confirmGoBack}
          >
            <Text style={styles.backButtonText}>돌아가기</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brand.primary,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  title: {
    fontFamily: 'SUIT-Bold',
    fontSize: 26,
    color: Colors.brand.white,
    marginBottom: 8,
    marginTop: 24,
  },
  description: {
    fontFamily: 'SUIT-Regular',
    fontSize: 15,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 22,
    marginBottom: 36,
  },
  sectionLabel: {
    fontFamily: 'SUIT-Bold',
    fontSize: 17,
    color: '#FFFFFF',
    marginBottom: 6,
  },
  sectionDescription: {
    fontFamily: 'SUIT-Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 20,
    marginBottom: 20,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  sectionHint: {
    fontFamily: 'SUIT-Regular',
    fontSize: 12,
    color: Colors.brand.accent,
    marginBottom: 6,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontFamily: 'SUIT-SemiBold',
    fontSize: 13,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  input: {
    fontFamily: 'SUIT-Regular',
    fontSize: 16,
    color: Colors.brand.white,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  bottomArea: {
    paddingHorizontal: 24,
    paddingVertical: 12,
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
  backButton: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  backButtonText: {
    fontFamily: 'SUIT-Regular',
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
  },
  submitText: {
    fontFamily: 'SUIT-Bold',
    fontSize: 16,
    color: Colors.brand.primary,
  },
});
