// 기존 STA 숫자 필드의 저장 형식은 분.초(mm.ss)이며, 총 초나 소수 분이 아니다.
export function parseSta(minutes: string, seconds: string): number | null {
  const min = minutes.trim();
  const sec = seconds.trim();
  if (!min && !sec) return null;
  if (!/^\d{0,2}$/.test(min) || !/^\d{0,2}$/.test(sec) || Number(sec) > 59) {
    throw new Error('STA는 분 0~99, 초 0~59로 입력해주세요.');
  }
  return Number(`${Number(min)}.${String(Number(sec)).padStart(2, '0')}`);
}

export function splitSta(value: number | null | undefined): { minutes: string; seconds: string } {
  if (value == null || !Number.isFinite(value) || value < 0) return { minutes: '', seconds: '' };
  const [minutes, seconds] = value.toFixed(2).split('.');
  return { minutes, seconds };
}

export function formatSta(value: number | null | undefined): string {
  const { minutes, seconds } = splitSta(value);
  return minutes ? `${Number(minutes)}분 ${Number(seconds)}초` : '--';
}
