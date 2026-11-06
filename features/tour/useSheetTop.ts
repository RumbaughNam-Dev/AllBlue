import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useScreenParams } from '@/features/split/SplitPane';

// 관리자 기능 화면은 프로필 시트 안에서 열릴 때(inSheet=1) 시트 위쪽 여백만 두고,
// 알림 · 링크로 따로 열리면 상태 표시줄을 피해 그림
export function useSheetTop() {
  const insets = useSafeAreaInsets();
  const { inSheet } = useScreenParams<{ inSheet?: string }>();
  return { top: inSheet && Platform.OS === 'ios' ? 10 : insets.top, inSheet: inSheet ? '1' : undefined };
}
