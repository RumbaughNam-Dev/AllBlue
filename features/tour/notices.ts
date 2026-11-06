// 22장 투어 알림을 누르면 갈 화면 (서버 tour-rules.ts TOUR_NOTICES와 같은 코드). 푸시 · 종 목록 모두 같은 곳으로
export type TourDestination =
  | { pathname: '/tour-requests' | '/tour-reports'; params: { focusTourId: string } }
  | { pathname: '/tour-detail' | '/tour-applications' | '/tour-proposals'; params: { id: string } }
  | { pathname: '/tour-mine'; params: { tab?: 'REGISTERED' | 'PROPOSED'; focusTourId?: string } };

const TO_DETAIL = ['TOUR_APPROVED', 'TOUR_EDIT_APPROVED', 'TOUR_ACCEPTED', 'TOUR_REJECTED', 'TOUR_APPLY_CLOSED', 'TOUR_SEEKING_LEADER', 'TOUR_CLOSED', 'TOUR_PROPOSAL_ACCEPTED', 'TOUR_UPDATED'];
const TO_REGISTERED = ['TOUR_REVISION', 'TOUR_EDIT_REVISION', 'TOUR_TAKEN_DOWN', 'TOUR_LEFT'];

// code: 알림 코드, tourId: 알림이 가리키는 투어. 투어 알림이 아니거나 갈 곳이 없으면(삭제됨) null
export function tourNoticeDestination(code: unknown, tourId: unknown): TourDestination | null {
  const id = Number(tourId);
  if (typeof code !== 'string' || !code.startsWith('TOUR_') || !Number.isSafeInteger(id) || id < 1) return null;
  const tour = String(id);
  if (code === 'TOUR_REQUEST' || code === 'TOUR_EDIT_REQUEST') return { pathname: '/tour-requests', params: { focusTourId: tour } };
  if (code === 'TOUR_REPORT') return { pathname: '/tour-reports', params: { focusTourId: tour } };
  if (code === 'TOUR_APPLY') return { pathname: '/tour-applications', params: { id: tour } };
  if (code === 'TOUR_PROPOSAL') return { pathname: '/tour-proposals', params: { id: tour } };
  if (TO_DETAIL.includes(code)) return { pathname: '/tour-detail', params: { id: tour } };
  if (TO_REGISTERED.includes(code)) return { pathname: '/tour-mine', params: { tab: 'REGISTERED' } };
  if (code === 'TOUR_PROPOSAL_CLOSED') return { pathname: '/tour-mine', params: { tab: 'PROPOSED' } };
  // 만료는 등록자 · 참여자가 받음: 등록한 탭에 없으면 참여한 탭으로
  if (code === 'TOUR_EXPIRED') return { pathname: '/tour-mine', params: { focusTourId: tour } };
  return null;
}
