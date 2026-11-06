import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { useAppRouter, useIsInPane, useIsSplit } from '@/features/split/SplitPane';

type Href = string | { pathname: string; params?: Record<string, unknown> };

// 24장: 펼친 화면에서도 목록 화면(전체보기 · 검색 · 내 투어 · 받은 제안 · admin 목록)은 좌우로 나누지 않고 전체 화면.
// 그런 전체 화면에서 연 상세 · 프로필도 전체 화면으로 (오른쪽 칸은 그 아래에 가려져 있어서).
// 오른쪽 칸 안의 화면(홈에서 연 상세)은 지금처럼 오른쪽 칸에서 한 단계 더.
export function useTourRouter() {
  const app = useAppRouter();
  const router = useRouter();
  const inPane = useIsInPane();
  const split = useIsSplit();
  return useMemo(() => (inPane || !split ? app : { ...app, push: (href: Href) => router.push(href as never) }), [app, router, inPane, split]);
}

// 프로필: 내 프로필은 '/profile', 다른 사람은 '/profile-view'
export const profileHref = (userId: string, myId?: string | null): Href =>
  userId === myId ? '/profile' : { pathname: '/profile-view', params: { userId } };

// 투어가 바뀐 뒤 (등록 · 신청 · 수락 · 제안 등) 홈 · 목록 · 상세가 새로 받도록
export const TOURS_CHANGED = 'toursChanged';
