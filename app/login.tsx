import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Easing, Alert, ActivityIndicator, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import Colors from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import KakaoLogo from '@/components/sns/KakaoLogo';
import GoogleLogo from '@/components/sns/GoogleLogo';
import NaverLogo from '@/components/sns/NaverLogo';
import AppleLogo from '@/components/sns/AppleLogo';

WebBrowser.maybeCompleteAuthSession();

const KAKAO_REST_API_KEY = 'b1b8a86fb3380ff331b52d75cb63ce82';
const GOOGLE_CLIENT_ID = '641869825877-apcgf1hsagbnnv8082ibvnqk60jcfs71.apps.googleusercontent.com';
const NAVER_CLIENT_ID = '5zyOGtt1ljV1kklWOYo5';
const APPLE_SERVICE_ID = 'com.rumbaugh.allblue.service';

const SNS_BUTTONS = [
  {
    key: 'kakao',
    label: '카카오로 시작하기',
    backgroundColor: '#FEE500',
    textColor: '#3C1E1E',
    Logo: KakaoLogo,
  },
  {
    key: 'google',
    label: '구글로 시작하기',
    backgroundColor: '#FFFFFF',
    textColor: '#3C4043',
    Logo: GoogleLogo,
  },
  {
    key: 'naver',
    label: '네이버로 시작하기',
    backgroundColor: '#03C75A',
    textColor: '#FFFFFF',
    Logo: NaverLogo,
  },
  {
    key: 'apple',
    label: '애플로 시작하기',
    backgroundColor: '#000000',
    textColor: '#FFFFFF',
    Logo: AppleLogo,
  },
];

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);

  const fadeAnims = useRef(SNS_BUTTONS.map(() => new Animated.Value(0))).current;
  const slideAnims = useRef(SNS_BUTTONS.map(() => new Animated.Value(24))).current;
  const titleFade = useRef(new Animated.Value(0)).current;
  const titleSlide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(titleFade, {
        toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
      Animated.timing(titleSlide, {
        toValue: 0, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
    ]).start();

    const buttonAnimations = SNS_BUTTONS.map((_, i) =>
      Animated.parallel([
        Animated.timing(fadeAnims[i], {
          toValue: 1, duration: 500, delay: 200 + i * 100,
          easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }),
        Animated.timing(slideAnims[i], {
          toValue: 0, duration: 500, delay: 200 + i * 100,
          easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }),
      ])
    );
    Animated.parallel(buttonAnimations).start();
  }, []);

  const handleKakaoLogin = async () => {
    const redirectUri = 'https://api.rumbaugh.co.kr/allblue/auth/kakao/callback';
    const appReturnUrl = Linking.createURL('kakao-callback');
    const authUrl =
      `https://kauth.kakao.com/oauth/authorize?` +
      `client_id=${KAKAO_REST_API_KEY}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&state=${encodeURIComponent(appReturnUrl)}`;

    try {
      setLoading(true);
      const result = await WebBrowser.openAuthSessionAsync(authUrl, appReturnUrl);
      if (result.type === 'success' && result.url) {
        const parsed = Linking.parse(result.url);
        const params = (parsed.queryParams ?? {}) as Record<string, string>;
        console.log('[카카오] 결과:', JSON.stringify(params));

        if (params.error) {
          Alert.alert('로그인 실패', params.error);
          return;
        }

        const isNewUser = params.isNewUser === 'true';
        if (isNewUser) {
          Alert.alert(
            '회원 정보가 없어요.',
            '추가 정보를 입력해주세요!',
            [
              {
                text: '확인',
                onPress: () =>
                  router.push({
                    pathname: '/register',
                    params: {
                      tempToken: params.tempToken,
                      nickname: params.nickname ?? '',
                      profileImage: params.profileImage ?? '',
                    },
                  }),
              },
            ]
          );
        } else {
          await login(params.token, {
            id: params.userId,
            name: params.name,
            nickname: params.nickname ?? params.name,
            profileImage: params.profileImage,
          });
          router.replace('/(tabs)');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const redirectUri = 'https://api.rumbaugh.co.kr/allblue/auth/google/callback';
    const appReturnUrl = Linking.createURL('google-callback');
    console.log('[구글] appReturnUrl:', appReturnUrl);
    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent('openid email profile')}` +
      `&state=${encodeURIComponent(appReturnUrl)}`;

    try {
      setLoading(true);
      const result = await WebBrowser.openAuthSessionAsync(authUrl, appReturnUrl);
      console.log('[구글] result type:', result.type);
      if (result.type === 'success' && result.url) {
        const parsed = Linking.parse(result.url);
        const params = (parsed.queryParams ?? {}) as Record<string, string>;
        console.log('[구글] 결과:', JSON.stringify(params));

        if (params.error) {
          Alert.alert('로그인 실패', params.error);
          return;
        }

        const isNewUser = params.isNewUser === 'true';
        if (isNewUser) {
          Alert.alert(
            '회원 정보가 없어요.',
            '추가 정보를 입력해주세요!',
            [
              {
                text: '확인',
                onPress: () =>
                  router.push({
                    pathname: '/register',
                    params: {
                      tempToken: params.tempToken,
                      nickname: params.nickname ?? '',
                      profileImage: params.profileImage ?? '',
                    },
                  }),
              },
            ]
          );
        } else {
          await login(params.token, {
            id: params.userId,
            name: params.name,
            nickname: params.nickname ?? params.name,
            profileImage: params.profileImage,
          });
          router.replace('/(tabs)');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleNaverLogin = async () => {
    const redirectUri = 'https://api.rumbaugh.co.kr/allblue/auth/naver/callback';
    const appReturnUrl = Linking.createURL('naver-callback');
    const authUrl =
      `https://nid.naver.com/oauth2.0/authorize?` +
      `client_id=${NAVER_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&state=${encodeURIComponent(appReturnUrl)}`;

    try {
      setLoading(true);
      const result = await WebBrowser.openAuthSessionAsync(authUrl, appReturnUrl);
      if (result.type === 'success' && result.url) {
        const parsed = Linking.parse(result.url);
        const params = (parsed.queryParams ?? {}) as Record<string, string>;
        console.log('[네이버] 결과:', JSON.stringify(params));

        if (params.error) {
          Alert.alert('로그인 실패', params.error);
          return;
        }

        const isNewUser = params.isNewUser === 'true';
        if (isNewUser) {
          Alert.alert(
            '회원 정보가 없어요.',
            '추가 정보를 입력해주세요!',
            [
              {
                text: '확인',
                onPress: () =>
                  router.push({
                    pathname: '/register',
                    params: {
                      tempToken: params.tempToken,
                      nickname: params.nickname ?? '',
                      profileImage: params.profileImage ?? '',
                    },
                  }),
              },
            ]
          );
        } else {
          await login(params.token, {
            id: params.userId,
            name: params.name,
            nickname: params.nickname ?? params.name,
            profileImage: params.profileImage,
          });
          router.replace('/(tabs)');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    const redirectUri = 'https://api.rumbaugh.co.kr/allblue/auth/apple/callback';
    const appReturnUrl = Linking.createURL('apple-callback');
    const authUrl =
      `https://appleid.apple.com/auth/authorize?` +
      `client_id=${APPLE_SERVICE_ID}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent('name email')}` +
      `&response_mode=form_post` +
      `&state=${encodeURIComponent(appReturnUrl)}`;

    try {
      setLoading(true);
      const result = await WebBrowser.openAuthSessionAsync(authUrl, appReturnUrl);
      if (result.type === 'success' && result.url) {
        const parsed = Linking.parse(result.url);
        const params = (parsed.queryParams ?? {}) as Record<string, string>;
        console.log('[애플] 결과:', JSON.stringify(params));

        if (params.error) {
          Alert.alert('로그인 실패', params.error);
          return;
        }

        const isNewUser = params.isNewUser === 'true';
        if (isNewUser) {
          Alert.alert(
            '회원 정보가 없어요.',
            '추가 정보를 입력해주세요!',
            [
              {
                text: '확인',
                onPress: () =>
                  router.push({
                    pathname: '/register',
                    params: {
                      tempToken: params.tempToken,
                      nickname: params.nickname ?? '',
                      profileImage: params.profileImage ?? '',
                    },
                  }),
              },
            ]
          );
        } else {
          await login(params.token, {
            id: params.userId,
            name: params.name,
            nickname: params.nickname ?? params.name,
            profileImage: params.profileImage,
          });
          router.replace('/(tabs)');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePress = (key: string) => {
    switch (key) {
      case 'kakao':
        handleKakaoLogin();
        break;
      case 'google':
        handleGoogleLogin();
        break;
      case 'naver':
        handleNaverLogin();
        break;
      case 'apple':
        handleAppleLogin();
        break;
      default:
        Alert.alert('준비 중', '아직 지원하지 않는 로그인 방식이에요.');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 32 }]}>
      <StatusBar style="light" />

      <Animated.View
        style={[styles.titleArea, { opacity: titleFade, transform: [{ translateY: titleSlide }] }]}
      >
        <Text style={styles.logo}>all<Text style={{ color: '#00E5FF' }}>b</Text>lue</Text>
      </Animated.View>

      <View style={styles.buttonArea}>
        {SNS_BUTTONS.map((btn, i) => (
          <Animated.View
            key={btn.key}
            style={{ opacity: fadeAnims[i], transform: [{ translateY: slideAnims[i] }] }}
          >
            <Pressable
              style={({ pressed }) => [
                styles.snsButton,
                { backgroundColor: btn.backgroundColor },
                pressed && styles.snsButtonPressed,
              ]}
              onPress={() => handlePress(btn.key)}
              disabled={loading}
            >
              <View style={styles.logoContainer}>
                <btn.Logo size={22} />
              </View>
              <Text style={[styles.snsButtonText, { color: btn.textColor }]}>{btn.label}</Text>
            </Pressable>
          </Animated.View>
        ))}
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={Colors.brand.white} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brand.primary,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  titleArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  logo: { fontFamily: 'SUIT-Regular', fontSize: 42, color: Colors.brand.white, letterSpacing: 8 },
  divider: { width: 24, height: 1, backgroundColor: 'rgba(255,255,255,0.25)', marginVertical: 16 },
  subtitle: {
    fontFamily: 'SUIT-Regular', fontSize: 13, color: 'rgba(255,255,255,0.35)',
    letterSpacing: 6, textTransform: 'uppercase',
  },
  buttonArea: { gap: 12 },
  snsButton: {
    flexDirection: 'row', alignItems: 'center', height: 54, borderRadius: 12, paddingHorizontal: 20,
  },
  snsButtonPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  logoContainer: { width: 28, alignItems: 'center' },
  snsButtonText: {
    flex: 1, textAlign: 'center', fontFamily: 'SUIT-SemiBold', fontSize: 15, marginRight: 28,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
