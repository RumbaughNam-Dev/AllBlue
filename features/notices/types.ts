export type NoticeInput = { title: string; content: string; pinned: boolean; popup: boolean };
export type Notice = NoticeInput & { id: number; authorName: string; createdAt: string; updatedAt: string };
// Shared by announcements and future image advertisements.
export type PopupSlide = { id: string; title: string } & (
  { kind: 'notice'; content: string } | { kind: 'image'; imageUrl: string; content?: string }
);
export const noticePreview = (content: string) => content.replace(/\s+/g, ' ').trim();
export function noticeDate(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return '날짜 확인 불가';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '날짜 확인 불가';
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}
export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}
