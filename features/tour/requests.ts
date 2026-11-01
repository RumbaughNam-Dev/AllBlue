import { Alert } from 'react-native';
import { api } from '@/services/api';

// 처리 결과: 처리됨(true) · 그대로(false). 다른 admin이 먼저 처리했으면 목록에서 빼면 되니 true
async function settle(run: () => Promise<unknown>, processedMessage: string) {
  try {
    await run();
    return true;
  } catch (e: any) {
    if (e?.code === 'PROCESSED') { Alert.alert('알림', processedMessage); return true; }
    if (!e?._handled) Alert.alert('알림', e?.message ?? '처리하지 못했어요. 잠시 후 다시 시도해 주세요.');
    return false;
  }
}

// 15장 승인: 확인 창을 거쳐 처리. 처리하면 true (취소 · 실패는 false)
export function confirmApprove(requestId: number, title: string): Promise<boolean> {
  return new Promise(resolve => {
    Alert.alert('투어를 승인할까요?', `'${title}'이(가) '준비중'으로 공개되고 강사에게 알려요.`, [
      { text: '취소', style: 'cancel', onPress: () => resolve(false) },
      { text: '승인', onPress: async () => resolve(await settle(() => api.approveTourRequest(requestId), '이미 처리된 요청이에요.')) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

// 15장 보완 요청: 보완 팝업에서 적은 내용과 함께 보냄
export const sendRevision = (requestId: number, note: string) => settle(() => api.reviseTourRequest(requestId, note), '이미 처리된 요청이에요.');

// '10.28 14:20' (요청 시각, 이 기기 시간대)
export function formatRequestedAt(iso: string) {
  const d = new Date(iso);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${two(d.getMonth() + 1)}.${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

// 19장 문제 없음: 확인 창을 거쳐 처리
export function confirmDismissReports(tourId: number, title: string): Promise<boolean> {
  return new Promise(resolve => {
    Alert.alert('문제 없음으로 처리할까요?', `'${title}'은(는) 그대로 공개되고 신고는 목록에서 빠져요.`, [
      { text: '취소', style: 'cancel', onPress: () => resolve(false) },
      { text: '문제 없음', onPress: async () => resolve(await settle(() => api.dismissTourReports(tourId), '이미 처리된 신고예요.')) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

// 19장 내리고 보완 요청: 투어를 비공개하고 보완 팝업에서 적은 내용을 강사에게 보냄
export const sendTakeDown = (tourId: number, note: string) => settle(() => api.takeDownTour(tourId, note), '이미 처리된 신고예요.');
