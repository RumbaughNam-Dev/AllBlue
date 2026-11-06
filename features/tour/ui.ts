import type { TourApplicationStatus, TourCard, TourProposalStatus, TourStatus, TourStyle } from '@/services/api';

type Badge = { label: string; color: string; text: string };

// 설계서 2장 상태 배지 (카드 · 상세 · 내 투어가 같은 색)
export const TOUR_STATUS: Record<TourStatus, Badge> = {
  PENDING: { label: '승인 대기', color: '#B8D4F0', text: '#023E73' },
  REVISION: { label: '보완 요청', color: '#FF8A75', text: '#FFFFFF' },
  RECRUITING: { label: '참여자 모집중', color: '#00B4D8', text: '#FFFFFF' },
  SEEKING_LEADER: { label: '인솔자 모집중', color: '#8E7CFF', text: '#FFFFFF' },
  CLOSED: { label: '모집 마감', color: '#FFD166', text: '#3A2A00' },
  EXPIRED: { label: '만료', color: '#9AA5B1', text: '#FFFFFF' },
};

// 참여한 탭: 신청 중 · 참여 확정
export const APPLICATION_STATUS: Partial<Record<TourApplicationStatus, Badge>> = {
  PENDING: { label: '신청 중', color: '#B8D4F0', text: '#023E73' },
  ACCEPTED: { label: '참여 확정', color: '#00B4D8', text: '#FFFFFF' },
};

// 제안한 탭: 승낙 대기 · 보류(인원이 다시 모이는 중) · 승낙됨 · 마감
export const PROPOSAL_STATUS: Record<TourProposalStatus, Badge> = {
  WAITING: { label: '승낙 대기', color: '#00B4D8', text: '#FFFFFF' },
  HELD: { label: '보류', color: '#B8D4F0', text: '#023E73' },
  ACCEPTED: { label: '승낙됨', color: '#FFD166', text: '#3A2A00' },
  CLOSED: { label: '마감', color: '#9AA5B1', text: '#FFFFFF' },
};

export const STYLE_LABEL: Record<TourStyle, string> = { DIVING_ONLY: '오직 다이빙만', DIVING_SIGHTSEEING: '다이빙 + 관광' };

export const CYAN = '#00E5FF';

// 메뉴 시트가 다 닫힌 뒤에 다음 창(확인 창 · 팝업 · 공유)을 열어야 iOS에서 뜸
export const AFTER_SHEET_MS = 600;
export const LAVENDER = '#C9C0FF';

// '2026-11-14', '2026-11-17' → '11.14 - 11.17'; 당일 투어는 하루만
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

// 카드 아래 글자 (3장 카드 모양):
// 참여자 모집중 = 나라 · 기간 / '인솔 닉네임' 또는 '인솔자 구함' / n/m명
// 인솔자 모집중 = 기간 · n명 모임 / 받은 제안 n
// 모집 마감 · 그 밖 = 나라 · 기간 / 인솔 닉네임 / n/m명
export function cardLines(tour: TourCard) {
  const period = formatTourPeriod(tour.startDate, tour.endDate);
  if (tour.status === 'SEEKING_LEADER') {
    return { meta: `${period} · ${tour.count}명 모임`, lead: `받은 제안 ${tour.proposalCount}`, leadColor: LAVENDER, count: null };
  }
  const lead = tour.leader ? `인솔 ${tour.leader.nickname}` : tour.status === 'RECRUITING' ? '인솔자 구함' : '';
  return { meta: `${tour.countryName} · ${period}`, lead, leadColor: tour.leader ? CYAN : LAVENDER, count: `${tour.count}/${tour.capacity}명` };
}

// 24장: 목록이 놓인 폭이 600pt 이상이면 한 줄 4개, 아니면 2개 (바형 · 접은 화면 · 펼친 화면의 한 칸)
export const GRID_WIDE = 600;
export const gridColumns = (width: number) => (width >= GRID_WIDE ? 4 : 2);
export const GRID_GAP = 10;
export const cardWidthFor = (width: number) => {
  const columns = gridColumns(width);
  return Math.floor((width - GRID_GAP * (columns - 1)) / columns);
};

// 21장 공유 내용: 투어 이름 · 나라 · 기간 + 링크. iOS는 url을 따로 넘겨야 링크 미리보기가 붙음
export function shareContent(tour: { name: string; countryName: string; startDate: string; endDate: string }, url: string, os: string) {
  const text = `${tour.name}\n${tour.countryName} · ${formatTourPeriod(tour.startDate, tour.endDate)}`;
  return os === 'ios' ? { message: text, url } : { message: `${text}\n${url}` };
}

// 'YYYY-MM-DD' (한국 날짜 기준 오늘 + days)
export function kstDay(days = 0, now = new Date()) {
  return new Date(now.getTime() + 9 * 3_600_000 + days * 86_400_000).toISOString().slice(0, 10);
}
