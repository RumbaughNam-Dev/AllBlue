import type { MyTourItem, MyTourTab, TourStatus } from '@/services/api';
import { editNotice } from './edit';
import { APPLICATION_STATUS, CYAN, LAVENDER, PROPOSAL_STATUS, TOUR_STATUS, formatFee, formatTourPeriod, placeLabel } from './ui';

// 10장 내 투어: 등록한 · 참여한 · 제안한(강사 · admin만). 카드마다 버튼 하나 + 나머지(수정 · 삭제 · 취소)는 '⋯'
export const MINE_TABS: { tab: MyTourTab; label: string; empty: string }[] = [
  { tab: 'REGISTERED', label: '등록한', empty: '등록한 투어가 없어요.' },
  { tab: 'JOINED', label: '참여한', empty: '참여한 투어가 없어요.' },
  { tab: 'PROPOSED', label: '제안한', empty: '제안한 투어가 없어요.' },
];
export const mineTabs = (canLead: boolean) => MINE_TABS.filter(t => canLead || t.tab !== 'PROPOSED');

export type MineAction = 'edit' | 'delete' | 'cancelEdit' | 'cancelApply' | 'leave' | 'withdraw';
export type MineGo = 'applications' | 'proposals' | 'edit' | 'proposalEdit' | 'detail';
export type MineCard = {
  badge: { label: string; color: string; text: string };
  lines: { where?: string; meta: string; lead: string; leadColor: string; count: string | null; note?: { text: string; color: string } };
  // 한 줄로 줄인 보완 내용을 누르면 전체를 보여 줌
  noteDetail?: { title: string; body: string };
  button: { label: string; kind: 'primary' | 'dark' | 'salmon'; go: MineGo };
  menu: { label: string; action: MineAction }[];
  // 끝난 투어 (모집 마감 · 만료, 제안한 탭은 승낙됨 · 마감)는 아래 '끝난 투어'로
  ended: boolean;
};

const ENDED: TourStatus[] = ['CLOSED', 'EXPIRED'];
const OPEN: TourStatus[] = ['RECRUITING', 'SEEKING_LEADER'];
const SALMON = '#FF8A75';
const PALE = '#B8D4F0';
const MUTED = 'rgba(255,255,255,0.55)';

// 제안한 탭 '마감' 카드의 이유 (서버 closedReason)
export const PROPOSAL_CLOSED_REASON: Record<string, string> = {
  OTHER_ACCEPTED: '다른 강사님의 제안으로 마감',
  EXPIRED: '출발일까지 모이지 않아 만료',
  DELETED: '등록자가 투어를 삭제함',
};

export function mineCard(tab: MyTourTab, item: MyTourItem): MineCard {
  const period = formatTourPeriod(item.startDate, item.endDate);
  const people = `${item.count} / ${item.capacity}명`;
  const view = { label: '투어 보기', kind: 'dark' as const, go: 'detail' as const };

  if (tab === 'PROPOSED' && item.proposal) {
    const p = item.proposal;
    const active = p.status === 'WAITING' || p.status === 'HELD';
    const [lead, leadColor] = p.status === 'WAITING' ? [`내 제안 ${formatFee(p.fee)}`, CYAN]
      : p.status === 'HELD' ? ['인원을 다시 모으는 중', LAVENDER]
      : p.status === 'ACCEPTED' ? ['모집 마감 · 내가 인솔', CYAN]
      : [PROPOSAL_CLOSED_REASON[p.closedReason ?? ''] ?? '마감됐어요', MUTED];
    return {
      badge: PROPOSAL_STATUS[p.status],
      lines: { where: placeLabel(item), meta: period, lead, leadColor, count: null },
      button: active ? { label: '제안 수정', kind: 'primary', go: 'proposalEdit' } : view,
      menu: active ? [{ label: '제안 취소', action: 'withdraw' }] : [],
      ended: !active,
    };
  }

  if (tab === 'JOINED') {
    const ended = ENDED.includes(item.status);
    const app = item.applicationStatus;
    const appBadge = app ? APPLICATION_STATUS[app] : undefined;
    const [lead, leadColor] = item.status === 'SEEKING_LEADER' ? ['인솔자를 찾는 중', LAVENDER]
      : item.leader ? [`인솔 ${item.leader.nickname}`, CYAN]
      : item.status === 'RECRUITING' ? ['인솔자 구함', LAVENDER]
      : ['', CYAN];
    return {
      badge: (!ended && appBadge) || TOUR_STATUS[item.status],
      lines: { where: placeLabel(item), meta: period, lead, leadColor, count: `${item.count}/${item.capacity}명` },
      button: view,
      // 참여 취소는 모집 마감 전까지 (뒤에는 인솔 강사에게 직접 연락)
      menu: app === 'PENDING' ? [{ label: '신청 취소', action: 'cancelApply' }]
        : app === 'ACCEPTED' && OPEN.includes(item.status) ? [{ label: '참여 취소', action: 'leave' }]
        : [],
      ended,
    };
  }

  // 등록한
  const ended = ENDED.includes(item.status);
  const card: MineCard = {
    badge: TOUR_STATUS[item.status],
    lines: {
      meta: item.status === 'SEEKING_LEADER' ? `${period} · ${item.count}명 모임` : `${period} · ${people}`,
      lead: item.status === 'CLOSED' && item.leader ? `인솔 ${item.leader.nickname}` : '', leadColor: CYAN, count: null,
    },
    button: view,
    menu: [],
    ended,
  };
  if (item.status === 'REVISION') {
    card.lines.note = { text: item.reviewNote ? `관리자: “${item.reviewNote}”` : '관리자가 보완을 요청했어요', color: SALMON };
    if (item.reviewNote) card.noteDetail = { title: '관리자 보완 요청', body: item.reviewNote };
  } else if (item.editRequest && !ended) {
    card.lines.note = { text: editNotice(item.editRequest) ?? '', color: item.editRequest.status === 'PENDING' ? PALE : SALMON };
    if (item.editRequest.status === 'REJECTED' && item.editRequest.reviewNote) card.noteDetail = { title: '수정 보완 요청', body: item.editRequest.reviewNote };
  }
  if (item.status === 'RECRUITING') card.button = { label: `참여 신청 ${item.pendingApplications ?? 0}`, kind: 'primary', go: 'applications' };
  if (item.status === 'SEEKING_LEADER') card.button = { label: `받은 제안 ${item.proposalCount}`, kind: 'primary', go: 'proposals' };
  if (item.status === 'REVISION') card.button = { label: '보완 후 재요청', kind: 'salmon', go: 'edit' };
  if (item.status === 'PENDING') card.button = { label: '수정', kind: 'dark', go: 'edit' };
  if (item.status === 'PENDING') card.menu = [{ label: '삭제', action: 'delete' }];
  if (item.status === 'REVISION') card.menu = [{ label: '등록 취소', action: 'delete' }];
  if (OPEN.includes(item.status)) {
    card.menu = [
      { label: '수정', action: 'edit' },
      ...(item.editRequest ? [{ label: '수정 취소', action: 'cancelEdit' as const }] : []),
      { label: '삭제', action: 'delete' },
    ];
  }
  return card;
}

// '⋯' 메뉴 동작의 확인 창 문구 (되돌릴 수 없는 것만 붉은 버튼)
export function mineConfirm(action: MineAction, item: MyTourItem): { title: string; message?: string; button: string; destructive: boolean } | null {
  switch (action) {
    case 'delete':
      if (item.status === 'REVISION') return { title: '등록을 취소할까요?', message: '투어가 지워지고 되돌릴 수 없어요.', button: '등록 취소', destructive: true };
      if (item.status === 'PENDING') return { title: '투어를 삭제할까요?', message: '승인 대기 중인 등록 요청도 함께 취소돼요. 되돌릴 수 없어요.', button: '삭제', destructive: true };
      return { title: '투어를 삭제할까요?', message: '참여자 · 신청자 · 제안한 강사에게 알림이 가요. 되돌릴 수 없어요.', button: '삭제', destructive: true };
    case 'cancelEdit':
      return { title: '수정 요청을 취소할까요?', message: '보낸 수정 내용은 버리고, 공개 중인 내용은 그대로예요.', button: '수정 취소', destructive: true };
    case 'cancelApply':
      return { title: '신청을 취소할까요?', button: '신청 취소', destructive: true };
    case 'leave':
      return { title: '참여를 취소할까요?', message: '인원이 모자라면 다시 참여자를 모집해요. 등록자에게 알려요.', button: '참여 취소', destructive: true };
    case 'withdraw':
      return { title: '제안을 취소할까요?', message: '등록자의 받은 제안 목록에서 빠져요.', button: '제안 취소', destructive: true };
    default:
      return null;
  }
}
