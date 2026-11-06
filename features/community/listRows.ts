import type { CommunityBoard } from '@/services/api';

// 게시판 전체보기 목록 모양 (에세이 · 자유게시판 · 교육단체 홍보). 화면 없이 계산만 해서 테스트함.

// 펼친 화면 (갤럭시Z폴드 · 아이폰듀오를 펼쳤을 때): 좌우 여백을 뺀 목록 폭 600 이상. 투어 목록과 같은 기준
export const WIDE_MIN = 600;
export const CARD_GAP = 10;
export const SIDE = 20; // 목록 좌우 여백
export const isWide = (inner: number) => inner >= WIDE_MIN;

// 한 줄에 몇 개: 바형 · 접은 화면은 그대로 (에세이 2 · 자유게시판 1 · 홍보 1), 펼친 화면은 에세이 · 자유게시판 4 · 홍보 2
export function boardColumns(board: CommunityBoard, inner: number) {
  const wide = isWide(inner);
  if (board === 'PROMO') return wide ? 2 : 1;
  if (board === 'ESSAY') return wide ? 4 : 2;
  return wide ? 4 : 1;
}

export const cellWidth = (inner: number, columns: number) => (inner > 0 ? Math.floor((inner - CARD_GAP * (columns - 1)) / columns) : 0);

// 줄 나누기 (한 줄에 여러 개): 무리(에세이는 쓴 날, 나머지는 목록 전체)마다 처음 본 맨 앞 자리부터 columns개씩.
// 자리는 목록 전체에서의 순서(base + i)라서 위 · 아래로 10개씩 붙이거나 덜어도 남은 글의 줄이 그대로 → 보던 자리가 안 튐
// (4개씩일 때 10개 단위가 안 맞아 매번 모든 줄이 다시 짜이던 것 방지). anchors는 처음부터 다시 받을 때 새로 (useRowAnchors).
export type GridRow<T> = { key: string; group: string; items: T[] };
export function gridRows<T>(items: T[], base: number, columns: number, anchors: Map<string, number>, groupOf: (item: T) => string = () => ''): GridRow<T>[] {
  const rows: GridRow<T>[] = [];
  items.forEach((item, i) => {
    const group = groupOf(item);
    const at = base + i;
    if (!anchors.has(group)) anchors.set(group, at);
    const key = `${group}:${Math.floor((at - (anchors.get(group) as number)) / columns)}`;
    const last = rows[rows.length - 1];
    if (last && last.key === key) last.items.push(item);
    else rows.push({ key, group, items: [item] });
  });
  return rows;
}

// 에세이: 쓴 날(기기 날짜)마다 작은 날짜 줄, 그 아래 columns개씩
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const pad = (n: number) => String(n).padStart(2, '0');
export const localDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const dayOf = (iso: string) => localDay(new Date(iso));
export function dayLabel(day: string, today: string) {
  const d = new Date(`${day}T00:00:00`);
  const label = `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
  return day === today ? `오늘 · ${label}` : d.getFullYear() === new Date(`${today}T00:00:00`).getFullYear() ? label : `${d.getFullYear()}년 ${label}`;
}

export type EssayRow<T> = { key: string; date: string } | { key: string; posts: T[] };
export function essayRows<T extends { createdAt: string }>(posts: T[], base: number, columns: number, anchors: Map<string, number>): EssayRow<T>[] {
  const rows: EssayRow<T>[] = [];
  let day = '';
  for (const row of gridRows(posts, base, columns, anchors, post => dayOf(post.createdAt))) {
    if (row.group !== day) { day = row.group; rows.push({ key: `d-${day}`, date: day }); }
    rows.push({ key: row.key, posts: row.items });
  }
  return rows;
}

// 검색 조건 (전체보기 맨 위): 작성일 · 검색어(제목 · 내용 · 태그) · 작성자. 비어 있으면 조건 없음 (작성일은 처음 ~ 오늘)
export type Conditions = { from: string; to: string; q: string; author: string };
export const NO_CONDITIONS: Conditions = { from: '', to: '', q: '', author: '' };
export const hasConditions = (c: Conditions) => !!(c.from || c.to || c.q || c.author);

// 시작일을 고르면 끝날이 그보다 앞일 때만 같이 당김 (끝날이 비어 있으면 '오늘'까지 그대로)
export const pickFrom = (c: Conditions, from: string): Partial<Conditions> => ({ from, to: c.to && c.to < from ? from : c.to });

// 작성일 칸 글자: 비어 있으면 처음 · 오늘, 펼친 화면 한 줄에선 연도를 두 자리로 줄임
export function dateText(day: string, side: 'from' | 'to', compact = false) {
  if (!day) return side === 'from' ? '처음' : '오늘';
  const dotted = day.replace(/-/g, '.');
  return compact ? dotted.slice(2) : dotted;
}
