// 커뮤니티 알림을 누르면 갈 화면 (서버 community-rules.ts의 COMMUNITY_* 코드)
export type CommunityDestination =
  | { pathname: '/community-post'; params: { id: string } }
  | { pathname: '/community-reports'; params: Record<string, never> };

// code: 알림 코드, postId: 알림이 가리키는 글 (출석인사를 내린 알림은 글이 없음). 커뮤니티 알림이 아니면 null
export function communityNoticeDestination(code: unknown, postId: unknown): CommunityDestination | null {
  if (typeof code !== 'string' || !code.startsWith('COMMUNITY_')) return null;
  if (code === 'COMMUNITY_REPORT') return { pathname: '/community-reports', params: {} };
  const id = Number(postId);
  // 내려진 글은 이미 없어서 열지 않음
  if (code === 'COMMUNITY_REMOVED' || !Number.isSafeInteger(id) || id < 1) return null;
  return { pathname: '/community-post', params: { id: String(id) } };
}
