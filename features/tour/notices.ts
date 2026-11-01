// 21장 투어 알림을 누르면 갈 화면 (서버 tour-notify.ts · common_code TOUR_NOTIFICATION과 같음)
export type TourDestination =
  | { pathname: '/tour-requests'; params: { focusTourId: string } }
  | { pathname: '/tour-reports'; params: { focusTourId: string } }
  | { pathname: '/tour-detail'; params: { id: string } }
  | { pathname: '/tour-manage'; params: Record<string, never> };

const TO_REQUESTS = ['REQUEST_CREATE', 'REQUEST_UPDATE'];
const TO_DETAIL = ['CREATE_APPROVED', 'UPDATE_APPROVED'];

// code: 알림 코드, tourId: 알림이 가리키는 투어. 투어 알림이 아니면 null
export function tourNoticeDestination(code: unknown, tourId: unknown): TourDestination | null {
  const id = Number(tourId);
  if (typeof code !== 'string' || !Number.isSafeInteger(id) || id < 1) return null;
  if (TO_REQUESTS.includes(code)) return { pathname: '/tour-requests', params: { focusTourId: String(id) } };
  if (code === 'REPORT_RECEIVED') return { pathname: '/tour-reports', params: { focusTourId: String(id) } };
  if (TO_DETAIL.includes(code)) return { pathname: '/tour-detail', params: { id: String(id) } };
  if (['CREATE_REJECTED', 'UPDATE_REJECTED', 'REPORT_TAKEN_DOWN', 'TOUR_ENDED', 'PROCESS_DEADLINE'].includes(code)) {
    return { pathname: '/tour-manage', params: {} };
  }
  return null;
}
