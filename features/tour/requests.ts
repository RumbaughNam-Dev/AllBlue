import { Alert } from 'react-native';
import { api } from '@/services/api';

export type RequestDecision = 'approve' | 'reject';

// 15장: 승인 · 불허는 확인 창을 거쳐 처리. 처리하면 true (취소 · 실패는 false)
export function confirmTourRequest(requestId: number, title: string, decision: RequestDecision): Promise<boolean> {
  const approve = decision === 'approve';
  return new Promise(resolve => {
    Alert.alert(
      approve ? '투어를 승인할까요?' : '투어를 불허할까요?',
      approve ? `'${title}'이(가) '준비중'으로 공개되고 강사에게 알려요.` : `'${title}'이(가) '불허'로 바뀌고 강사에게 알려요.\n자세한 사유는 강사에게 따로 전해 주세요.`,
      [
        { text: '취소', style: 'cancel', onPress: () => resolve(false) },
        {
          text: approve ? '승인' : '불허',
          style: approve ? 'default' : 'destructive',
          onPress: async () => {
            try {
              await (approve ? api.approveTourRequest(requestId) : api.rejectTourRequest(requestId));
              resolve(true);
            } catch (e: any) {
              // 다른 admin이 먼저 처리했으면 목록에서 빼면 됨
              if (e?.code === 'PROCESSED') { Alert.alert('알림', '이미 처리된 요청이에요.'); resolve(true); return; }
              if (!e?._handled) Alert.alert('알림', e?.message ?? '처리하지 못했어요. 잠시 후 다시 시도해 주세요.');
              resolve(false);
            }
          },
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

// '10.28 14:20' (요청 시각, 이 기기 시간대)
export function formatRequestedAt(iso: string) {
  const d = new Date(iso);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${two(d.getMonth() + 1)}.${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

export type ReportDecision = 'dismiss' | 'takeDown';

// 19장: 문제 없음 / 불허로 내리기 (확인 창을 거쳐 처리). 처리하면 true
export function confirmTourReports(tourId: number, title: string, decision: ReportDecision): Promise<boolean> {
  const takeDown = decision === 'takeDown';
  return new Promise(resolve => {
    Alert.alert(
      takeDown ? '불허로 내릴까요?' : '문제 없음으로 처리할까요?',
      takeDown ? `'${title}'이(가) '불허'로 비공개되고 강사에게 알려요.\n강사는 고쳐서 다시 요청할 수 있어요.` : `'${title}'은(는) 그대로 공개되고 신고는 목록에서 빠져요.`,
      [
        { text: '취소', style: 'cancel', onPress: () => resolve(false) },
        {
          text: takeDown ? '내리기' : '문제 없음',
          style: takeDown ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await (takeDown ? api.takeDownTour(tourId) : api.dismissTourReports(tourId));
              resolve(true);
            } catch (e: any) {
              if (e?.code === 'PROCESSED') { Alert.alert('알림', '이미 처리된 신고예요.'); resolve(true); return; }
              if (!e?._handled) Alert.alert('알림', e?.message ?? '처리하지 못했어요. 잠시 후 다시 시도해 주세요.');
              resolve(false);
            }
          },
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
