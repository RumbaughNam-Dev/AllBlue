import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Platform, useWindowDimensions } from 'react-native';
import type { ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from 'expo-router';
import { hasSideTabStrip } from '@/utils/tabBarLayout';

// 아이폰 듀오의 오른쪽 여백 위쪽에 세로로 늘어선 카메라·위치·시계·배터리 표시 바로 아래 (창 기준 pt).
// 접은 화면에서 이 표시가 약 200pt까지 내려옴
const STRIP_BACK_TOP = 212;

// 화면 왼쪽 위의 뒤로가기 버튼을 감쌈. 오른쪽 여백이 있는 기기(아이폰 듀오)에서는 원래 자리를
// 같은 크기로 비워 두고(제목 위치 유지), 버튼만 모든 화면에서 같은 곳 — 여백의 상태 표시 아래 — 에 그림.
// 펼친 화면 오른쪽 칸에서 연 화면도 같은 곳에 그림 (오른쪽 칸 첫 화면은 뒤로가기가 없음).
export default function StripBackSlot({ size, children }: { size: number; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const navigation = useNavigation();
  const lift = hasSideTabStrip(insets.right, Platform.OS);
  const ref = useRef<ViewInstance>(null);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);

  const measure = useCallback(() => {
    ref.current?.measureInWindow((x, y) => {
      // 화면이 밀려 들어오는 중에는 창 밖 좌표가 나오므로, 다 들어온 뒤 다시 잼
      if (x >= 0 && x < width) setOrigin({ x, y });
    });
  }, [width]);

  useEffect(() => {
    if (!lift) return;
    return navigation.addListener('transitionEnd' as never, measure);
  }, [lift, navigation, measure]);

  if (!lift) return <>{children}</>;
  return (
    <View ref={ref} onLayout={measure} style={{ width: size, height: size }}>
      {origin && (
        <View style={{
          position: 'absolute',
          left: width - insets.right + (insets.right - size) / 2 - origin.x,
          top: STRIP_BACK_TOP - origin.y,
        }}>
          {children}
        </View>
      )}
    </View>
  );
}
