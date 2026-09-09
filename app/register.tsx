import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, StyleSheet, Pressable, Alert,
  Animated, Easing, KeyboardAvoidingView, Platform,
  ActivityIndicator, BackHandler,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Colors from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';

type Step = 'name' | 'phone' | 'verify';

export default function RegisterScreen() {
  const { tempToken, nickname } = useLocalSearchParams<{
    tempToken: string;
    nickname?: string;
  }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login } = useAuth();

  const [step, setStep] = useState<Step>('name');
  const [nicknameTxt, setNicknameTxt] = useState(nickname ?? '');
  const [phone, setPhone] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [loading, setLoading] = useState(false);

  // 인증번호 요청 제한
  const [requestCount, setRequestCount] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [cooldownText, setCooldownText] = useState('');
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // 애니메이션
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const stepAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  // 쿨다운 타이머
  useEffect(() => {
    if (cooldownUntil) {
      cooldownTimer.current = setInterval(() => {
        const remaining = Math.ceil((cooldownUntil - Date.now()) / 1000);
        if (remaining <= 0) {
          setCooldownUntil(null);
          setCooldownText('');
          setRequestCount((prev) => Math.max(0, prev - 1));
          if (cooldownTimer.current) clearInterval(cooldownTimer.current);
        } else {
          const min = Math.floor(remaining / 60);
          const sec = remaining % 60;
          setCooldownText(`${min}:${String(sec).padStart(2, '0')}`);
        }
      }, 1000);
      return () => { if (cooldownTimer.current) clearInterval(cooldownTimer.current); };
    }
  }, [cooldownUntil]);

  const animateStep = (callback: () => void) => {
    Animated.timing(stepAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      callback();
      Animated.timing(stepAnim, { toValue: 1, duration: 250, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    });
  };

  const formatPhone = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  };

  const phoneDigits = phone.replace(/\D/g, '');
  const isValidPhone = phoneDigits.length === 10 || phoneDigits.length === 11;

  const hasInput = nicknameTxt.trim() !== (nickname ?? '') || phone.trim() || verifyCode.trim();

  const confirmGoBack = useCallback(() => {
    if (hasInput) {
      Alert.alert('확인', '입력한 데이터가 초기화 되요.\n돌아가시겠어요?', [
        { text: '아니오', style: 'cancel' },
        { text: '네', onPress: () => router.replace('/login') },
      ]);
    } else {
      router.replace('/login');
    }
  }, [hasInput, router]);

  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 'verify') animateStep(() => setStep('phone'));
      else if (step === 'phone') animateStep(() => setStep('name'));
      else confirmGoBack();
      return true;
    });
    return () => handler.remove();
  }, [step, confirmGoBack]);

  // 이름 입력 완료
  const handleNameNext = () => {
    if (!nicknameTxt.trim()) {
      Alert.alert('알림', '이름을 입력해주세요.');
      return;
    }
    animateStep(() => setStep('phone'));
  };

  // Firebase 인증번호 요청
  const handleSendCode = async () => {
    if (!isValidPhone) {
      Alert.alert('알림', '전화번호를 정확히 입력해주세요.');
      return;
    }

    // 쿨다운 체크
    if (cooldownUntil && Date.now() < cooldownUntil) {
      Alert.alert('알림', `잠시 후 다시 시도해주세요.\n(${cooldownText} 남음)`);
      return;
    }

    const newCount = requestCount + 1;
    setRequestCount(newCount);

    if (newCount >= 5) {
      const penaltyMinutes = (newCount - 4) * 5;
      setCooldownUntil(Date.now() + penaltyMinutes * 60 * 1000);
    }

    setLoading(true);
    try {
      const res = await api.sendVerificationCode(phoneDigits, tempToken!);
      if (!res.success) {
        Alert.alert('알림', res.message || '인증번호 발송에 실패했습니다.');
        return;
      }
      Alert.alert('알림', '인증번호가 발송되었습니다.');
      if (step !== 'verify') {
        animateStep(() => setStep('verify'));
      }
    } catch (e: any) {
      if (!e._handled) Alert.alert('오류', '인증번호 발송에 실패했습니다.\n다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  // 인증번호 확인 + 회원가입
  const handleVerifyAndRegister = async () => {
    if (verifyCode.trim().length < 4) {
      Alert.alert('알림', '인증번호를 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      // 인증번호 확인
      const verifyRes = await api.verifyCode(phoneDigits, verifyCode.trim(), tempToken!);
      if (!verifyRes.success) {
        Alert.alert('알림', verifyRes.message || '인증번호가 일치하지 않습니다.');
        return;
      }

      // 회원가입
      const res = await api.register(tempToken!, {
        nickname: nicknameTxt.trim(),
        birthDate: '',
        phone: phoneDigits,
      });
      console.log('[Register] response:', JSON.stringify(res));
      await login(res.token, res.user);
      Alert.alert('가입 완료', `${res.user.nickname}님, 환영합니다!\nAllBlue와 함께 안전한 다이빙 되세요.`);
    } catch (e: any) {
      console.log('[Register] error:', JSON.stringify(e));
      if (!e._handled) Alert.alert('오류', e.message || '가입에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case 'name': return '이름을 입력해주세요';
      case 'phone': return '전화번호를 입력해주세요';
      case 'verify': return '인증번호를 입력해주세요';
    }
  };

  const getStepDescription = () => {
    switch (step) {
      case 'name': return '서비스에서 사용할 이름입니다.';
      case 'phone': return '본인 인증을 위해 전화번호가 필요합니다.';
      case 'verify': return `${phone}으로 발송된\n인증번호를 입력해주세요.`;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Text style={styles.title}>회원 정보 입력</Text>

          <Animated.View style={{ opacity: stepAnim }}>
            <Text style={styles.stepTitle}>{getStepTitle()}</Text>
            <Text style={styles.stepDescription}>{getStepDescription()}</Text>

            {step === 'name' && (
              <View style={styles.inputGroup}>
                <TextInput
                  style={styles.input}
                  value={nicknameTxt}
                  onChangeText={setNicknameTxt}
                  placeholder="이름"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  autoFocus
                  returnKeyType="next"
                  onSubmitEditing={handleNameNext}
                />
              </View>
            )}

            {step === 'phone' && (
              <View style={styles.inputGroup}>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={(t) => setPhone(formatPhone(t))}
                  placeholder="010-0000-0000"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  keyboardType="phone-pad"
                  maxLength={13}
                  autoFocus
                />
              </View>
            )}

            {step === 'verify' && (
              <>
                <View style={styles.inputGroup}>
                  <TextInput
                    style={styles.input}
                    value={verifyCode}
                    onChangeText={setVerifyCode}
                    placeholder="인증번호 입력"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus
                  />
                </View>
                <Pressable
                  style={({ pressed }) => [styles.resendButton, pressed && { opacity: 0.6 }]}
                  onPress={handleSendCode}
                  disabled={loading || (cooldownUntil !== null && Date.now() < cooldownUntil)}
                >
                  <Text style={styles.resendText}>
                    {cooldownUntil && Date.now() < cooldownUntil
                      ? `재요청 대기 (${cooldownText})`
                      : '인증번호 다시 받기'}
                  </Text>
                </Pressable>
              </>
            )}
          </Animated.View>
        </Animated.View>

        <View style={styles.bottomArea}>
          <Pressable
            style={({ pressed }) => [
              styles.nextButton,
              (step === 'name' && !nicknameTxt.trim()) && styles.nextButtonDisabled,
              (step === 'phone' && !isValidPhone) && styles.nextButtonDisabled,
              (step === 'verify' && verifyCode.trim().length < 4) && styles.nextButtonDisabled,
              pressed && { opacity: 0.85 },
            ]}
            onPress={() => {
              if (step === 'name') handleNameNext();
              else if (step === 'phone') handleSendCode();
              else handleVerifyAndRegister();
            }}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={Colors.brand.primary} />
            ) : (
              <Text style={styles.nextText}>
                {step === 'verify' ? '가입 완료' : step === 'phone' ? '인증번호 받기' : '다음'}
              </Text>
            )}
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}
            onPress={() => {
              if (step === 'verify') animateStep(() => setStep('phone'));
              else if (step === 'phone') animateStep(() => setStep('name'));
              else confirmGoBack();
            }}
          >
            <Text style={styles.backButtonText}>
              {step === 'name' ? '돌아가기' : '이전'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.brand.primary },
  content: { flex: 1, paddingHorizontal: 24 },
  title: {
    fontFamily: 'SUIT-Bold', fontSize: 26, color: Colors.brand.white,
    marginTop: 24, marginBottom: 36,
  },
  stepTitle: {
    fontFamily: 'SUIT-Bold', fontSize: 20, color: Colors.brand.white, marginBottom: 8,
  },
  stepDescription: {
    fontFamily: 'SUIT-Regular', fontSize: 14, color: 'rgba(255,255,255,0.5)',
    lineHeight: 22, marginBottom: 24,
  },
  inputGroup: { marginBottom: 16 },
  input: {
    fontFamily: 'SUIT-Regular', fontSize: 18, color: Colors.brand.white,
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  resendButton: { alignSelf: 'flex-start', paddingVertical: 8 },
  resendText: { fontFamily: 'SUIT-SemiBold', fontSize: 14, color: Colors.brand.warning },
  bottomArea: { paddingHorizontal: 24, paddingVertical: 12 },
  nextButton: {
    height: 54, borderRadius: 14, backgroundColor: Colors.brand.white,
    alignItems: 'center', justifyContent: 'center',
  },
  nextButtonDisabled: { opacity: 0.4 },
  nextText: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.primary },
  backButton: { height: 48, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  backButtonText: { fontFamily: 'SUIT-Regular', fontSize: 14, color: 'rgba(255,255,255,0.5)' },
});
