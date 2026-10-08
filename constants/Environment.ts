import { channel } from 'expo-updates';

// The installed build channel remains authoritative when an OTA update is loaded.
// Local Metro and unconfigured local exports always use the development API.
const environment = __DEV__ ? 'development' : (channel ?? process.env.EXPO_PUBLIC_APP_ENV ?? 'development');
export const API_BASE_URL = environment === 'production'
  ? 'https://api.rumbaugh.co.kr/allblue'
  : 'https://api-dev.rumbaugh.co.kr/allblue';

export function authCallbackUrl(provider: 'kakao' | 'google' | 'naver' | 'apple') {
  // Preserve the original registered OAuth callback independently of the API environment.
  return `https://api.rumbaugh.co.kr/allblue/auth/${provider}/callback`;
}
