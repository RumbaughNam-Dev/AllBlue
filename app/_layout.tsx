import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import SplashView from '@/components/SplashView';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();
SystemUI.setBackgroundColorAsync('#144A84');

function RootLayoutNav() {
  const { isLoggedIn, hasSeenOnboarding, isLoading, login } = useAuth();
  const router = useRouter();
  const segments = useSegments();
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
    } else if (isLoggedIn && !inApp && !['profile','profile-edit','profile-view','cert-upload','cert-manage','schedule-daily','schedule-detail','schedule-add','achievement','debriefing','blocked-users','inquiry','inquiry-write','inquiry-detail','inquiry-manage','inquiry-answer','withdraw'].includes(segments[0] as string)) {
      router.replace('/(tabs)');
    }

    if (!routeReady.current) {
      routeReady.current = true;
    }
  }, [isLoggedIn, hasSeenOnboarding, isLoading, segments]);


  if (!ready || !splashDone) {
    return <SplashView onFinish={() => { setSplashDone(true); setReady(true); }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#144A84' }}>
      <StatusBar style="light" />
      <Stack screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#144A84' },
        gestureEnabled: false,
        animation: 'simple_push',
        navigationBarColor: '#144A84',
        freezeOnBlur: false,
      }}>
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="profile" options={{ presentation: 'fullScreenModal', contentStyle: { backgroundColor: '#144A84' } }} />
        <Stack.Screen name="profile-edit" options={{ presentation: 'fullScreenModal', contentStyle: { backgroundColor: '#144A84' } }} />
        <Stack.Screen name="cert-upload" options={{ presentation: 'fullScreenModal', contentStyle: { backgroundColor: '#144A84' } }} />
        <Stack.Screen name="cert-manage" options={{ presentation: 'fullScreenModal', contentStyle: { backgroundColor: '#144A84' } }} />
        <Stack.Screen name="schedule-daily" options={{ gestureEnabled: true }} />
        <Stack.Screen name="schedule-detail" options={{ gestureEnabled: true }} />
        <Stack.Screen name="schedule-add" options={{ gestureEnabled: true }} />
        <Stack.Screen name="profile-view" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="achievement" options={{ gestureEnabled: true }} />
        <Stack.Screen name="debriefing" options={{ gestureEnabled: true }} />
        <Stack.Screen name="blocked-users" options={{ gestureEnabled: true }} />
        <Stack.Screen name="inquiry" options={{ gestureEnabled: true }} />
        <Stack.Screen name="inquiry-write" options={{ gestureEnabled: true }} />
        <Stack.Screen name="inquiry-detail" options={{ gestureEnabled: true }} />
        <Stack.Screen name="inquiry-manage" options={{ presentation: 'fullScreenModal', contentStyle: { backgroundColor: '#144A84' } }} />
        <Stack.Screen name="inquiry-answer" options={{ gestureEnabled: true }} />
        <Stack.Screen name="withdraw" options={{ gestureEnabled: true }} />
      </Stack>
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
      <RootLayoutNav />
    </AuthProvider>
  );
}
