import type { TourBannerItem } from '@/services/api';

// 22장 배너 상태 배지: 노출 중 · 예정 · 종료, 꺼둔 배너와 연결 투어가 내려간 배너도 구분
export const BANNER_STATE: Record<TourBannerItem['state'], { label: string; color: string; text: string }> = {
  LIVE: { label: '노출 중', color: '#00B4D8', text: '#032A36' },
  SCHEDULED: { label: '예정', color: '#8FB3D9', text: '#0B2440' },
  ENDED: { label: '종료', color: '#9AA5B1', text: '#1B232B' },
  OFF: { label: '꺼짐', color: '#9AA5B1', text: '#1B232B' },
  HIDDEN: { label: '투어 비공개', color: '#FFD166', text: '#3D2B00' },
};

// '2026-11-01' → '11.01'
export const shortDay = (day: string) => `${day.slice(5, 7)}.${day.slice(8, 10)}`;

export type BannerForm = { imageUri: string; remote: boolean; mimeType: string; tourId: number | null; startDate: string; endDate: string; isEnabled: boolean };

// 저장 버튼이 켜지는 조건: 이미지 · 투어 · 기간 (종료일 ≥ 시작일)
export function bannerFormError(form: BannerForm) {
  if (!form.imageUri) return '배너 이미지를 올려 주세요';
  if (!form.tourId) return '연결할 투어를 골라 주세요';
  if (!form.startDate || !form.endDate) return '노출 기간을 골라 주세요';
  if (form.endDate < form.startDate) return '종료일이 시작일보다 빨라요';
  return null;
}
