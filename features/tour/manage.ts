import type { TourStatus } from '@/services/api';

// Mirrors common_code TOUR_CONFIG PROCESS_DAYS: 종료일 다음 날부터 이 기간 안에 처리, 지나면 미처리.
export const PROCESS_DAYS = 7;
export const PUBLIC_STATUSES: TourStatus[] = ['PREPARING', 'RECRUITING', 'CLOSED'];
// 8장 '처리'에서 고를 수 있는 상태
export const PROCESS_OPTIONS: { status: TourStatus; label: string }[] = [
  { status: 'PREPARING', label: '투어 준비중' },
  { status: 'RECRUITING', label: '모집중' },
  { status: 'CLOSED', label: '모집 마감' },
  { status: 'CANCELED', label: '모집 취소' },
  { status: 'COMPLETED', label: '투어 완료' },
];

const dayMs = 86_400_000;
const toTime = (day: string) => Date.parse(`${day}T00:00:00Z`);

// 일정이 끝났는데 아직 처리하지 않은 공개 투어: 처리 기한까지 남은 날 (D-n). 그 밖은 null.
export function processDaysLeft(status: TourStatus, endDate: string, today: string) {
  if (!PUBLIC_STATUSES.includes(status) || toTime(today) <= toTime(endDate)) return null;
  return Math.max(0, Math.round((toTime(endDate) + PROCESS_DAYS * dayMs - toTime(today)) / dayMs));
}

// 카드 안내 문구 (8 · 10장). 보완 요청이면 관리자가 적은 내용을 함께 보여줌
// 역제안 응답 기한 'M월 D일 HH:mm' (기기 시간대)
export function wishDeadlineText(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// 역제안으로 만든 투어: 제안자 응답 안내 (다른 안내보다 먼저)
export function wishNotice(status: TourStatus, offer?: { status: 'WAITING' | 'ACCEPTED' | 'DECLINED'; deadline: string | null } | null) {
  if (!offer) return null;
  if (offer.status === 'WAITING') {
    const by = wishDeadlineText(offer.deadline);
    return status === 'WISH_WAITING'
      ? `승인됐어요. 제안자가 ${by}까지 응하면 '준비중'으로 공개돼요.`
      : `역제안으로 만든 투어예요. 제안자가 ${by}까지 응하면 정식 투어가 돼요.`;
  }
  if (offer.status === 'ACCEPTED' && status === 'PENDING') return '제안자가 응했어요. 관리자 승인이 끝나면 공개돼요.';
  if (offer.status === 'DECLINED') return '제안자가 응하지 않아 투어가 열리지 않았어요.';
  return null;
}

export function manageNotice(status: TourStatus, endDate: string, today: string, reviewNote?: string | null) {
  if (status === 'PENDING') return '관리자 승인을 기다리고 있어요. 승인되면 알림으로 알려드려요.';
  if (status === 'REJECTED') return reviewNote ? `관리자가 보완을 요청했어요\n“${reviewNote}”` : '관리자가 보완을 요청했어요. 보완해서 다시 요청해 주세요.';
  const left = processDaysLeft(status, endDate, today);
  if (left !== null) return `일정이 지난 투어예요. ${PROCESS_DAYS}일 내에 투어를 처리해주세요  ·  ${left === 0 ? 'D-DAY' : `D-${left}`}`;
  return null;
}

// 카드에 보이는 조작: 공개 중이면 + / − · 처리 · 수정 · 삭제, 승인 대기면 수정 · 삭제, 보완 요청이면 보완 후 재요청 · 등록 취소, 지난 투어는 삭제만
export function manageActions(status: TourStatus) {
  const isPublic = PUBLIC_STATUSES.includes(status);
  return {
    adjust: isPublic,
    process: isPublic,
    // 응답 대기(역제안)는 제안자가 응해 공개된 뒤에 수정
    edit: status === 'PENDING' || status === 'REJECTED' || isPublic,
    editLabel: status === 'REJECTED' ? '보완 후 재요청' : '수정',
    remove: true,
    removeLabel: status === 'REJECTED' ? '등록 취소' : '삭제',
  };
}
