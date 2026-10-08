import { Platform } from 'react-native';
import { api } from './api';

let Notifications: any = null;
let Device: any = null;
let Constants: any = null;

try {
  Notifications = require('expo-notifications');
  Device = require('expo-device');
  Constants = require('expo-constants').default;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
} catch {
  if (__DEV__) console.warn('[push] 알림 모듈을 불러오지 못했습니다. 설치된 빌드의 네이티브 모듈을 확인하세요.');
}

export async function registerForPushNotifications(authToken: string): Promise<string | null> {
  if (!Notifications || !Device || !Constants) {
    return null;
  }
  if (!Device.isDevice) return null;

  let stage = 'notification-channel';
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    stage = 'permissions';
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      if (__DEV__) console.info('[push] 알림 권한이 허용되지 않아 토큰 등록을 건너뜁니다.');
      return null;
    }

    const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    if (!projectId) {
      if (__DEV__) console.warn('[push] EAS projectId가 없어 토큰을 발급할 수 없습니다.');
      return null;
    }

    stage = 'expo-token';
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    // 서버에 토큰 등록
    stage = 'server-registration';
    await api.registerPushToken(token, authToken);

    if (__DEV__) console.info('[push] 서버에 푸시 토큰을 등록했습니다.');
    return token;
  } catch {
    // Log only the failing stage; never include authentication or push tokens.
    if (__DEV__) console.warn(`[push] 토큰 등록 실패: ${stage}`);
    return null;
  }
}

export async function unregisterPushToken(token: string, authToken: string) {
  try {
    await api.unregisterPushToken(token, authToken);
  } catch {}
}

// Subscribe only after authentication/navigation are ready. The last response
// covers cold launches; the listener covers foreground/background taps.
const handledScheduleResponses = new Set<string>();
export function observeSchedulePushes(onOpen: (scheduleId: number, notificationId?: number) => void, onReceive: () => void) {
  if (!Notifications) return () => {};
  let active = true;
  const handle = (response: any) => {
    if (!active || !response?.notification) return;
    const request = response.notification.request;
    const data = request.content?.data;
    const id = Number(data?.scheduleId);
    if (data?.type !== 'schedule' || !Number.isSafeInteger(id) || id < 1 || handledScheduleResponses.has(request.identifier)) return;
    handledScheduleResponses.add(request.identifier);
    if (handledScheduleResponses.size > 100) handledScheduleResponses.delete(handledScheduleResponses.values().next().value!);
    const notificationId = Number(data.notificationId);
    onOpen(id, Number.isSafeInteger(notificationId) && notificationId > 0 ? notificationId : undefined);
  };
  const response = Notifications.addNotificationResponseReceivedListener(handle);
  const received = Notifications.addNotificationReceivedListener(onReceive);
  Notifications.getLastNotificationResponseAsync().then(handle).catch(() => {});
  return () => { active = false; response.remove(); received.remove(); };
}
