import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  console.log('[Push] 시작, isDevice:', Device.isDevice);
  if (!Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  console.log('[Push] 기존 권한:', existingStatus);
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
    console.log('[Push] 요청 후 권한:', finalStatus);
  }

  if (finalStatus !== 'granted') {
    console.log('[Push] 권한 거부됨');
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  console.log('[Push] projectId:', projectId);
  if (!projectId) {
    console.log('[Push] projectId 없음');
    return null;
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    console.log('[Push] 토큰 발급:', token);

    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    // 서버에 토큰 등록
    await api.registerPushToken(token);
    console.log('[Push] 서버 등록 완료');

    return token;
  } catch (e) {
    console.log('[Push] 에러:', e);
    return null;
  }
}

export async function unregisterPushToken(token: string) {
  try {
    await api.unregisterPushToken(token);
  } catch {}
}
