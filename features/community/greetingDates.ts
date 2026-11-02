// 출석인사 날짜 계산 (한국 날짜 'YYYY-MM-DD' 문자열 그대로)
export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function shiftDay(day: string, delta: number) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}
export function shiftMonth(month: string, delta: number) {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + delta);
  return date.toISOString().slice(0, 7);
}
// '11월 2일 (월)'
export function dayLabel(day: string) {
  const date = new Date(`${day}T00:00:00Z`);
  return `${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일 (${WEEKDAYS[date.getUTCDay()]})`;
}
// 달력 칸: 첫 주 앞은 빈칸(null)
export function monthCells(month: string) {
  const first = new Date(`${month}-01T00:00:00Z`);
  const days = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return [...Array(first.getUTCDay()).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)] as (string | null)[];
}

