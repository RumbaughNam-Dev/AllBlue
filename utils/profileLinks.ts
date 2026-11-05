// 프로필 링크 (프로필 편집의 '링크'): 서버 profile-links.ts와 같은 규칙
export const PROFILE_LINK_LIMITS = { nameMax: 20, urlMax: 500 };

// 앞뒤 공백을 빼고, https://가 없으면 붙임. 주소로 볼 수 없으면 null.
export function normalizeLinkUrl(value: string) {
  const trimmed = value.trim();
  const url = /^https?:\/\//i.test(trimmed) ? trimmed.replace(/^http:\/\//i, 'https://') : `https://${trimmed}`;
  return url.length <= PROFILE_LINK_LIMITS.urlMax && /^https:\/\/[^\s/?#]+\.[^\s/?#]+(?:[/?#]\S*)?$/i.test(url) ? url : null;
}

// 링크 추가 팝업: 칸 아래 빨간 글씨 (빈 칸은 아직 안 알림)
export function linkErrors(name: string, url: string) {
  const errors: { name?: string; url?: string } = {};
  if (name.trim().length > PROFILE_LINK_LIMITS.nameMax) errors.name = `${PROFILE_LINK_LIMITS.nameMax}자까지 넣을 수 있어요`;
  if (url.trim() && !normalizeLinkUrl(url)) errors.url = '주소를 다시 확인해 주세요';
  return errors;
}

// 길게 눌러 끌어 순서 바꾸기
export function moveItem<T>(list: T[], from: number, to: number) {
  if (from === to || from < 0 || from >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item);
  return next;
}
