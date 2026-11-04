import { PopupBlurProvider } from '@/components/PopupBackdrop';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments, useGlobalSearchParams } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useRef, useState } from 'react';
import { View, DeviceEventEmitter, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hasSideTabStrip } from '@/utils/tabBarLayout';
import { StripTabBarHost } from '@/components/StripTabBarHost';
import { observeCommunityPushes, observeSchedulePushes, observeTourPushes } from '@/services/push';
import { communityNoticeDestination } from '@/features/community/notices';
import { tourNoticeDestination } from '@/features/tour/notices';
import { api } from '@/services/api';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import SplashView from '@/components/SplashView';
import { useScheduleLinkResume } from '@/hooks/useScheduleLinkResume';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();
SystemUI.setBackgroundColorAsync('#144A84');

function RootLayoutNav() {
  const { isLoggedIn, hasSeenOnboarding, isLoading, login } = useAuth();
  const router = useRouter();
  // 아이폰 듀오처럼 좌우에 상태표시·버튼 영역이 있는 기기에서 그 영역을 피해 그림
  const { left, right } = useSafeAreaInsets();
  // 그런 기기는 상태표시가 오른쪽으로 가서 위쪽 여백이 거의 0 — 상단 바가 맨 위에 붙지 않게 살짝 띄움
  const side = { paddingLeft: left, paddingRight: right, paddingTop: hasSideTabStrip(right, Platform.OS) ? 12 : 0 };
  const segments = useSegments();
  const linkParams = useGlobalSearchParams<{ id?: string; filter?: string }>();
  useScheduleLinkResume({
    route: segments[0], id: linkParams.id, filter: linkParams.filter,
    isLoading, isLoggedIn, replace: router.replace,
  });
  const [ready, setReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const routeReady = useRef(false);
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    if (isLoading) return;

    const inOnboarding = segments[0] === 'onboarding';
    const inLogin = segments[0] === 'login';
    const inRegister = segments[0] === 'register';
    const inApp = segments[0] === '(tabs)';

    if (!hasSeenOnboarding && !inOnboarding) {
      router.replace('/onboarding');
    } else if (hasSeenOnboarding && !isLoggedIn && !inLogin && !inRegister) {
      router.replace('/login');
    } else if (isLoggedIn && !inApp && !['notices','notice-detail','notice-edit','profile','profile-edit','profile-view','cert-upload','cert-manage','schedule-daily','schedule-detail','schedule-add','achievement','debriefing','blocked-users','inquiry','inquiry-write','inquiry-detail','inquiry-manage','inquiry-answer','withdraw','schedule-settings','organization-register','organization-manage','organization-members','tour-create','tour-search','tour-detail','tour-manage','tour-requests','tour-reports','tour-banners','tour-banner-edit','community-posts','community-post','community-post-search','community-essay-write','community-free-write','community-promo-edit','community-greetings','community-reports','tour-wish','tour-wishes','tour-wish-search'].includes(segments[0] as string)) {
      router.replace('/(tabs)');
    }

    if (!routeReady.current) {
      routeReady.current = true;
    }
  }, [isLoggedIn, hasSeenOnboarding, isLoading, segments]);


  useEffect(() => {
    if (!isLoggedIn || isLoading || !ready || !splashDone) return;
    return observeSchedulePushes((scheduleId, notificationId) => {
      if (notificationId) void api.readNotification(notificationId).then(() => DeviceEventEmitter.emit('notificationsChanged')).catch(() => {});
      routerRef.current.push({ pathname: '/schedule-detail', params: { id: String(scheduleId), filter: 'notification' } });
    }, () => DeviceEventEmitter.emit('notificationsChanged'));
  }, [isLoggedIn, isLoading, ready, splashDone]);

  // 21장 투어 알림 푸시: 등록요청 목록 · 신고 처리 · 투어 상세 · 투어 관리로
  useEffect(() => {
    if (!isLoggedIn || isLoading || !ready || !splashDone) return;
    return observeTourPushes((code, tourId, notificationId) => {
      if (notificationId) void api.readNotification(notificationId).then(() => DeviceEventEmitter.emit('notificationsChanged')).catch(() => {});
      const destination = tourNoticeDestination(code, tourId);
      if (destination) routerRef.current.push(destination);
    });
  }, [isLoggedIn, isLoading, ready, splashDone]);

  // 커뮤니티 알림 푸시: 그 글로 (admin 신고 알림은 신고 처리로)
  useEffect(() => {
    if (!isLoggedIn || isLoading || !ready || !splashDone) return;
    return observeCommunityPushes((code, postId, notificationId) => {
      if (notificationId) void api.readNotification(notificationId).then(() => DeviceEventEmitter.emit('notificationsChanged')).catch(() => {});
      const destination = communityNoticeDestination(code, postId);
      if (destination) routerRef.current.push(destination);
    });
  }, [isLoggedIn, isLoading, ready, splashDone]);

  if (!ready || !splashDone) {
    return <SplashView onFinish={() => { setSplashDone(true); setReady(true); }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#144A84' }}>
      <StatusBar style="light" />
      <StripTabBarHost>
        <Stack screenOptions={{
          headerShown: false,
          contentStyle: { ...side, backgroundColor: '#144A84' },
          gestureEnabled: false,
          animation: 'simple_push',
          navigationBarColor: '#144A84',
          freezeOnBlur: false,
        }}>
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
          <Stack.Screen name="(tabs)" />
          {/* 아래에서 올라오는 시트는 iOS가 이미 오른쪽 여백을 피해 놓으므로 여백 패딩을 넣지 않음 */}
          <Stack.Screen name="profile" options={{ presentation: 'modal', gestureEnabled: true, animation: 'default', contentStyle: { backgroundColor: '#144A84' } }} />
          <Stack.Screen name="profile-edit" options={{ presentation: 'fullScreenModal', contentStyle: { ...side, backgroundColor: '#144A84' } }} />
          <Stack.Screen name="cert-upload" options={{ gestureEnabled: true, contentStyle: { ...side, backgroundColor: '#144A84' } }} />
          <Stack.Screen name="cert-manage" options={{ gestureEnabled: true, contentStyle: { ...side, backgroundColor: '#144A84' } }} />
          <Stack.Screen name="schedule-daily" options={{ gestureEnabled: true }} />
          <Stack.Screen name="schedule-detail" options={{ gestureEnabled: true }} />
          <Stack.Screen name="schedule-add" options={{ gestureEnabled: true, headerBackButtonMenuEnabled: false }} />
          <Stack.Screen name="profile-view" options={{ presentation: 'modal', gestureEnabled: true, animation: 'default', contentStyle: { backgroundColor: '#144A84' } }} />
          <Stack.Screen name="achievement" options={{ gestureEnabled: true }} />
          <Stack.Screen name="debriefing" options={{ gestureEnabled: true }} />
          <Stack.Screen name="blocked-users" options={{ gestureEnabled: true }} />
          <Stack.Screen name="inquiry" options={{ gestureEnabled: true }} />
          <Stack.Screen name="inquiry-write" options={{ gestureEnabled: true }} />
          <Stack.Screen name="inquiry-detail" options={{ gestureEnabled: true }} />
          <Stack.Screen name="inquiry-manage" options={{ gestureEnabled: true, contentStyle: { ...side, backgroundColor: '#144A84' } }} />
          <Stack.Screen name="inquiry-answer" options={{ gestureEnabled: true }} />
          <Stack.Screen name="withdraw" options={{ gestureEnabled: true }} />
          <Stack.Screen name="schedule-settings" options={{ gestureEnabled: true }} />
          <Stack.Screen name="organization-register" options={{ gestureEnabled: true, contentStyle: { ...side, backgroundColor: '#144A84' } }} />
          <Stack.Screen name="organization-manage" options={{ gestureEnabled: true, contentStyle: { ...side, backgroundColor: '#144A84' } }} />
          <Stack.Screen name="organization-members" options={{ gestureEnabled: true, contentStyle: { ...side, backgroundColor: '#144A84' } }} />
          {/* 밀어서 닫으면 작성 중인 내용이 사라지므로 뒤로가기 버튼(확인 창)으로만 나감 */}
          <Stack.Screen name="tour-create" options={{ contentStyle: { ...side, backgroundColor: '#144A84' } }} />
          <Stack.Screen name="tour-search" options={{ gestureEnabled: true }} />
          <Stack.Screen name="tour-detail" options={{ gestureEnabled: true }} />
          <Stack.Screen name="tour-manage" options={{ gestureEnabled: true }} />
          <Stack.Screen name="tour-requests" options={{ gestureEnabled: true }} />
          <Stack.Screen name="tour-reports" options={{ gestureEnabled: true }} />
          <Stack.Screen name="tour-banners" options={{ gestureEnabled: true }} />
          <Stack.Screen name="tour-banner-edit" options={{ gestureEnabled: true }} />
          <Stack.Screen name="community-posts" options={{ gestureEnabled: true }} />
          <Stack.Screen name="community-post-search" options={{ gestureEnabled: true }} />
          <Stack.Screen name="community-post" options={{ gestureEnabled: true }} />
          <Stack.Screen name="community-essay-write" options={{ contentStyle: { ...side, backgroundColor: '#144A84' } }} />
          <Stack.Screen name="community-free-write" options={{ contentStyle: { ...side, backgroundColor: '#144A84' } }} />
          <Stack.Screen name="community-promo-edit" options={{ contentStyle: { ...side, backgroundColor: '#144A84' } }} />
          {/* 가운데 좌우 밀기는 날짜 이동: iOS 26의 화면 전체 밀어서 닫기를 끄고 왼쪽 끝 밀기로만 닫음 */}
          <Stack.Screen name="community-greetings" options={{ gestureEnabled: true, fullScreenGestureEnabled: false }} />
          <Stack.Screen name="community-reports" options={{ gestureEnabled: true, contentStyle: { ...side, backgroundColor: '#144A84' } }} />
          <Stack.Screen name="tour-wish" options={{ gestureEnabled: true, contentStyle: { ...side, backgroundColor: '#144A84' } }} />
          <Stack.Screen name="tour-wishes" options={{ gestureEnabled: true }} />
          <Stack.Screen name="tour-wish-search" options={{ gestureEnabled: true }} />
        </Stack>
      </StripTabBarHost>
    </View>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    'SUIT-Regular': require('../assets/fonts/SUIT-Regular.ttf'),
    'SUIT-SemiBold': require('../assets/fonts/SUIT-SemiBold.ttf'),
    'SUIT-Bold': require('../assets/fonts/SUIT-Bold.ttf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <AuthProvider>
      <PopupBlurProvider><RootLayoutNav /></PopupBlurProvider>
    </AuthProvider>
  );
}
