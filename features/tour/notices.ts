// 21장 투어 알림을 누르면 갈 화면 (서버 tour-notify.ts · common_code TOUR_NOTIFICATION과 같음)
export type TourDestination =
  | { pathname: '/tour-requests'; params: { focusTourId: string } }
  | { pathname: '/tour-reports'; params: { focusTourId: string } }
  | { pathname: '/tour-detail'; params: { id: string } }
  | { pathname: '/tour-manage'; params: Record<string, never> }
  | { pathname: '/tour-wishes'; params: Record<string, never> };

const TO_REQUESTS = ['REQUEST_CREATE', 'REQUEST_UPDATE'];
const TO_DETAIL = ['CREATE_APPROVED', 'UPDATE_APPROVED'];

// code: 알림 코드, tourId: 알림이 가리키는 투어. 투어 알림이 아니면 null
export function tourNoticeDestination(code: unknown, tourId: unknown): TourDestination | null {
  // 투어 역제안은 가리키는 투어 없이 역제안 목록으로
  if (code === 'TOUR_WISH') return { pathname: '/tour-wishes', params: {} };
  // 역제안으로 만든 투어가 도착 → 제안자는 투어 상세에서 '이 투어에 응하기'
  const id = Number(tourId);
  if (typeof code !== 'string' || !Number.isSafeInteger(id) || id < 1) return null;
  if (TO_REQUESTS.includes(code)) return { pathname: '/tour-requests', params: { focusTourId: String(id) } };
  if (code === 'REPORT_RECEIVED') return { pathname: '/tour-reports', params: { focusTourId: String(id) } };
  if (TO_DETAIL.includes(code) || code === 'WISH_OFFER') return { pathname: '/tour-detail', params: { id: String(id) } };
  if (['WISH_ACCEPTED', 'WISH_DECLINED', 'WISH_APPROVED_WAITING', 'CREATE_REJECTED', 'UPDATE_REJECTED', 'REPORT_TAKEN_DOWN', 'TOUR_ENDED', 'PROCESS_DEADLINE'].includes(code)) {
    return { pathname: '/tour-manage', params: {} };
  }
  return null;
}
