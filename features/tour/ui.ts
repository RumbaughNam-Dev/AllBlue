import { Alert } from 'react-native';
import type { TourStatus } from '@/services/api';

// Mirrors common_code TOUR_STATUS (label, badge color) on the server.
export const TOUR_STATUS: Record<TourStatus, { label: string; color: string; text: string }> = {
  PENDING: { label: '승인 대기', color: '#B794F4', text: '#1E0F3D' },
  REJECTED: { label: '불허', color: '#C53030', text: '#FFFFFF' },
  PREPARING: { label: '준비중', color: '#8FB3D9', text: '#0B2440' },
  RECRUITING: { label: '모집중', color: '#00B4D8', text: '#032A36' },
  CLOSED: { label: '모집 마감', color: '#FFD166', text: '#3D2B00' },
  CANCELED: { label: '모집 취소', color: '#FF6B4A', text: '#3D0F04' },
  COMPLETED: { label: '투어 완료', color: '#2DC48D', text: '#03301F' },
  UNPROCESSED: { label: '미처리', color: '#9AA5B1', text: '#1B232B' },
};

// '2026-11-14', '2026-11-17' → '11.14 - 11.17'; a one-day tour shows one date.
export function formatTourPeriod(startDate: string, endDate: string) {
  const short = (date: string) => `${date.slice(5, 7)}.${date.slice(8, 10)}`;
  return startDate === endDate ? short(startDate) : `${short(startDate)} - ${short(endDate)}`;
}

// '4박 5일', 하루면 '당일'
export function formatStay(startDate: string, endDate: string) {
  const nights = Math.round((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000);
  return nights <= 0 ? '당일' : `${nights}박 ${nights + 1}일`;
}

export const formatFee = (fee: number) => `${String(fee).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}원`;

export function formatRecruitment(recruited: number, capacity: number) {
  return `${recruited}/${capacity}명`;
}

// 24장 공유 내용: 투어명 · 나라 · 기간 + 링크. iOS는 url을 따로 넘겨야 링크 미리보기가 붙음
export function shareContent(tour: { title: string; countryName: string; startDate: string; endDate: string }, url: string, os: string) {
  const text = `${tour.title}\n${tour.countryName} · ${formatTourPeriod(tour.startDate, tour.endDate)}`;
  return os === 'ios' ? { message: text, url } : { message: `${text}\n${url}` };
}

// Screens the tour home links to that come in later steps (create, manage, search, detail, see all).
export function showTourComingSoon() {
  Alert.alert('준비 중이에요', '이 화면은 다음 단계에서 만들어요.');
}
