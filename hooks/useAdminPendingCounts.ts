import { useCallback, useRef, useState } from 'react';
import { api } from '@/services/api';

export type AdminPendingCounts = { inquiry: number; cert: number; org: number; tourRequests: number; tourReports: number; communityReports: number };
const NONE: AdminPendingCounts = { inquiry: 0, cert: 0, org: 0, tourRequests: 0, tourReports: 0, communityReports: 0 };

// 16장: 관리자 기능의 처리할 건수. 프로필의 '관리자 기능' 버튼 · 팝업과 홈 프로필 사진의 빨간 숫자가 같은 합계를 씀.
export function adminPendingTotal(counts: AdminPendingCounts) {
  return counts.inquiry + counts.cert + counts.org + counts.tourRequests + counts.tourReports + counts.communityReports;
}

// 홈 프로필 사진 빨간 숫자: 0이면 숨김, 100 이상은 99+
export function adminBadgeText(total: number) {
  return total <= 0 ? null : total > 99 ? '99+' : String(total);
}

export function useAdminPendingCounts(isAdmin: boolean) {
  const [counts, setCounts] = useState<AdminPendingCounts>(NONE);
  const requestId = useRef(0);
  const reload = useCallback(async () => {
    const id = ++requestId.current;
    if (!isAdmin) { setCounts(NONE); return; }
    // 하나가 실패하면 그 건수만 이전 값 유지
    const [inquiry, cert, org, tour, reports, community] = await Promise.all([
      api.getInquiryPendingCount().then(r => r.count).catch(() => null),
      api.getCertPendingCount().then(r => r.count).catch(() => null),
      api.getPendingOrganizations().then(r => (r.organizations ?? []).length).catch(() => null),
      api.getTourRequests().then(r => r.requests.length).catch(() => null),
      api.getTourReports().then(r => r.tours.length).catch(() => null),
      api.getCommunityReportCount().then(r => r.count).catch(() => null),
    ]);
    if (id !== requestId.current) return;
    setCounts(prev => ({
      inquiry: inquiry ?? prev.inquiry, cert: cert ?? prev.cert, org: org ?? prev.org, tourRequests: tour ?? prev.tourRequests,
      tourReports: reports ?? prev.tourReports, communityReports: community ?? prev.communityReports,
    }));
  }, [isAdmin]);
  return { counts, total: adminPendingTotal(counts), reload };
}
