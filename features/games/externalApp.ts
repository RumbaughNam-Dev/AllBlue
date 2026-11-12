import { Linking, Platform } from 'react-native';

// 따로 출시한 우리 앱을 게임 고르기에서 열기 (사용자 2026-11-12): 깔려 있으면 앱 주소(URL 스킴)로 바로 열고,
// 열지 못하면(안 깔려 있으면) 앱 스토어 · 플레이 스토어로. canOpenURL은 iOS Info.plist 등록(네이티브 빌드)이
// 있어야 해서 쓰지 않고, 바로 열어 보고 실패하면 스토어로 감 (openURL은 등록 없이도 됨)
export type ExternalApp = {
  // Expo는 iOS 빌드에 번들 id를 스킴으로 넣어 줌. 안드로이드는 app.json에 scheme이 있어야만 생김
  url: string;
  appStoreId: string; // App Store 숫자 id
  androidPackage: string;
};

async function tryOpen(url: string) {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

export async function openExternalApp(app: ExternalApp) {
  if (await tryOpen(app.url)) return;
  const stores = Platform.OS === 'android'
    ? [`market://details?id=${app.androidPackage}`, `https://play.google.com/store/apps/details?id=${app.androidPackage}`]
    : [`itms-apps://apps.apple.com/app/id${app.appStoreId}`, `https://apps.apple.com/app/id${app.appStoreId}`];
  for (const url of stores) {
    if (await tryOpen(url)) return;
  }
}
