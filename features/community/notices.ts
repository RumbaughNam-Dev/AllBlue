// 커뮤니티 알림을 누르면 갈 화면 (서버 community-rules.ts의 COMMUNITY_* 코드)
export type CommunityDestination =
  | { pathname: '/community-post'; params: { id: string } }
  | { pathname: '/community-greetings'; params: { date?: string } }
  | { pathname: '/community-reports'; params: Record<string, never> };

// code: 알림 코드, postId: 알림이 가리키는 글 (출석인사를 내린 알림은 글이 없음). 커뮤니티 알림이 아니면 null
// date: 출석인사 태그 알림의 그 날 (푸시는 서버가 실어 보내고, 종은 알림 시각의 한국 날짜)
export function communityNoticeDestination(code: unknown, postId: unknown, date?: unknown): CommunityDestination | null {
  if (typeof code !== 'string' || !code.startsWith('COMMUNITY_')) return null;
  if (code === 'COMMUNITY_REPORT') return { pathname: '/community-reports', params: {} };
  if (code === 'COMMUNITY_GREETING_MENTION') {
    return { pathname: '/community-greetings', params: typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? { date } : {} };
  }
  const id = Number(postId);
  // 내려진 글은 이미 없어서 열지 않음
  if (code === 'COMMUNITY_REMOVED' || !Number.isSafeInteger(id) || id < 1) return null;
  return { pathname: '/community-post', params: { id: String(id) } };
}

// 알림 시각(ISO) → 한국 날짜 YYYY-MM-DD (출석인사는 한국 날짜 기준)
export function koreaDay(iso: unknown) {
  const time = typeof iso === 'string' ? Date.parse(iso) : NaN;
  return Number.isFinite(time) ? new Date(time + 9 * 60 * 60 * 1000).toISOString().slice(0, 10) : undefined;
}
