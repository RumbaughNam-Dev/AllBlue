import type { TourDetail, TourLink, TourStyle } from '@/services/api';

// 공개 중인 인솔자 투어의 수정본 (서버 tour_request.payload와 같은 모양, 날짜는 YYYY-MM-DD)
// place: 투어 장소 — 2026-11-08 전에 만든 수정본에는 없음
export type EditPayload = {
  continentCode: string; countryCode: string; place?: string; startDate: string; endDate: string; tourStyle: TourStyle;
  images: string[]; coverIndex: number; title: string; fee: number | null; included: string[]; excluded: string[]; links: TourLink[];
};

// admin 카드 '바뀐 항목: 소개 이미지 · 참가비'와 상세의 안내
export const EDIT_FIELD_LABELS: Record<string, string> = {
  images: '소개 이미지', title: '투어명', region: '지역', place: '투어 장소', period: '기간', style: '투어 형태',
  fee: '참가비', included: '포함 사항', excluded: '불포함 사항', links: '문의 링크',
};
export const changedLabels = (fields: string[]) => fields.map(f => EDIT_FIELD_LABELS[f] ?? f).join(' · ');

// admin이 수정 요청을 심사할 때: 지금 공개 중인 내용 위에 수정본을 얹어 보여줌 (지역 이름은 regionName으로)
export function withEdit(detail: TourDetail, edit: EditPayload, regionName: (code: string) => string): TourDetail {
  return {
    ...detail,
    tour: {
      ...detail.tour,
      title: edit.title, name: edit.title || detail.tour.name, continentCode: edit.continentCode, countryCode: edit.countryCode,
      continentName: regionName(edit.continentCode) || edit.continentCode, countryName: regionName(edit.countryCode) || edit.countryCode,
      place: edit.place || detail.tour.place, startDate: edit.startDate, endDate: edit.endDate, tourStyle: edit.tourStyle, fee: edit.fee,
      images: edit.images, coverIndex: edit.coverIndex, included: edit.included, excluded: edit.excluded,
    },
    links: edit.links,
  };
}

// 내 투어 카드: 공개 중인 투어의 수정본 상태 안내 (한 줄)
export function editNotice(edit: { status: 'PENDING' | 'REJECTED'; reviewNote: string | null } | null | undefined) {
  if (!edit) return null;
  if (edit.status === 'PENDING') return '수정 내용 승인 대기 중';
  return edit.reviewNote ? `수정 보완 요청: “${edit.reviewNote}”` : '수정 내용에 보완 요청이 있어요';
}
