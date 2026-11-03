import type { TourDetail, TourLink } from '@/services/api';

// 18장 공개 중인 투어의 수정본 (서버 tour_request.payload와 같은 모양)
export type EditPayload = {
  title: string; continentCode: string; countryCode: string; startDate: string; endDate: string;
  capacity: number; fee: number | null; images: string[]; included: string[]; excluded: string[]; links: TourLink[];
};
export type EditRequest = { id: number; status: 'PENDING' | 'REJECTED'; reviewNote: string | null; changedFields: string[]; payload: EditPayload };

// admin 카드 '바뀐 항목: 소개 이미지 · 참가비'와 상세의 '바뀜' 표시
export const EDIT_FIELD_LABELS: Record<string, string> = {
  images: '소개 이미지', title: '투어명', region: '지역', period: '투어 기간', capacity: '모집 인원',
  fee: '참가비', included: '포함 사항', excluded: '불포함 사항', links: '문의 링크',
};
export const changedLabels = (fields: string[]) => fields.map(f => EDIT_FIELD_LABELS[f] ?? f).join(' · ');

// admin이 수정 요청을 심사할 때: 지금 공개 중인 내용 위에 수정본을 얹어 보여줌 (지역 이름은 regionName으로)
export function withEdit(detail: TourDetail, edit: EditPayload, regionName: (code: string) => string): TourDetail {
  return {
    ...detail,
    tour: {
      ...detail.tour,
      title: edit.title, continentCode: edit.continentCode, countryCode: edit.countryCode,
      continentName: regionName(edit.continentCode) || edit.continentCode, countryName: regionName(edit.countryCode) || edit.countryCode,
      startDate: edit.startDate, endDate: edit.endDate, capacity: edit.capacity, fee: edit.fee,
      images: edit.images, included: edit.included, excluded: edit.excluded,
    },
    links: edit.links,
  };
}

// 투어 관리 카드: 공개 중인 투어의 수정본 상태 안내
export function editNotice(edit: { status: 'PENDING' | 'REJECTED'; reviewNote: string | null } | null | undefined) {
  if (!edit) return null;
  if (edit.status === 'PENDING') return '수정한 내용이 승인을 기다리고 있어요\n승인 전까지는 이전 내용이 보여요';
  return edit.reviewNote ? `수정 내용에 보완 요청이 있어요\n“${edit.reviewNote}”` : '수정 내용에 보완 요청이 있어요. 지금은 이전 내용이 보여요';
}
