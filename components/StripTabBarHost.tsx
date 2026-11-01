import React, { createContext, useCallback, useContext, useState } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import CustomTabBar from '@/components/CustomTabBar';
import { hasSideTabStrip } from '@/utils/tabBarLayout';

type SetBar = (props: BottomTabBarProps | null) => void;
const StripTabBarContext = createContext<SetBar | null>(null);

// 오른쪽 여백이 있는 기기(아이폰 듀오)의 세로 탭 바는 앱 맨 위 층에 그려서, 2뎁스 이하 화면이
// 올라와도 항상 보이게 함. 탭 화면(TabsBody)이 탭 바 정보를 넘겨줌.
export function StripTabBarHost({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [barProps, setBarProps] = useState<BottomTabBarProps | null>(null);
  // 2뎁스 이하 화면에서 탭을 누르면 쌓인 화면을 모두 닫고 그 탭으로 감
  const leaveStack = useCallback(() => {
    if (!router.canDismiss()) return false;
    router.dismissAll();
    return true;
  }, [router]);
  return (
    <StripTabBarContext.Provider value={setBarProps}>
      {children}
      {hasSideTabStrip(insets.right, Platform.OS) && barProps && (
        <CustomTabBar {...barProps} stripWidth={insets.right} leaveStack={leaveStack} />
      )}
    </StripTabBarContext.Provider>
  );
}

export function useStripTabBarSetter() {
  return useContext(StripTabBarContext);
}

// 탭 바 정보를 StripTabBarHost로 넘기기만 하고, 그 자리에는 아무것도 그리지 않음
export function StripTabBarRelay({ onChange, ...props }: BottomTabBarProps & { onChange: SetBar }) {
  const { state, emitter, navigateToTab } = props;
  React.useEffect(() => {
    onChange(props);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, emitter, navigateToTab, onChange]);
  React.useEffect(() => () => onChange(null), [onChange]);
  return null;
}
