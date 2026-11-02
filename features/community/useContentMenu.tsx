import React, { useState } from 'react';
import { Alert } from 'react-native';
import BottomSheet from '@/components/BottomSheet';
import { api, type CommunityReportTarget } from '@/services/api';
import ReportPopup from './ReportPopup';

export type MenuTarget = {
  type: CommunityReportTarget; id: number;
  author: { userId: string; nickname: string };
  mine: boolean; canDelete: boolean;
  onEdit?: () => void;
  onDeleted: () => void;
  onBlocked: () => void;
};

const NOUN: Record<CommunityReportTarget, string> = { POST: '글', COMMENT: '댓글', GREETING: '인사' };
type Action = 'edit' | 'delete' | 'report' | 'block';

// 4 · 9 · 11장 '⋯' · 길게 누르기 메뉴: 내 것은 수정 · 삭제, 남의 것은 신고하기 · 작성자 차단 (admin은 삭제도)
export function useContentMenu() {
  const [target, setTarget] = useState<MenuTarget | null>(null);
  const [reporting, setReporting] = useState<MenuTarget | null>(null);

  const items = !target ? [] : [
    ...(target.mine && target.onEdit ? [{ label: '수정', value: 'edit' }] : []),
    ...(target.canDelete ? [{ label: target.mine ? '삭제' : '삭제 (관리자)', value: 'delete' }] : []),
    ...(!target.mine ? [{ label: '신고하기', value: 'report' }, { label: `${target.author.nickname}님 차단`, value: 'block' }] : []),
  ];

  const remove = (t: MenuTarget) => {
    const noun = NOUN[t.type];
    Alert.alert(`${noun} 삭제`, t.mine ? `이 ${noun}을(를) 지울까요?` : `${t.author.nickname}님의 ${noun}을(를) 지울까요? 작성자에게 알림이 가요.`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => {
        try {
          if (t.type === 'POST') await api.deleteCommunityPost(t.id);
          else if (t.type === 'COMMENT') await api.deleteCommunityComment(t.id);
          else await api.deleteGreeting(t.id);
          t.onDeleted();
        } catch (e: any) { if (!e?._handled) Alert.alert('삭제하지 못했어요', e?.message ?? '다시 시도해 주세요.'); }
      } },
    ]);
  };

  const block = (t: MenuTarget) => {
    Alert.alert('작성자 차단', `${t.author.nickname}님을 차단할까요?\n차단하면 이 사람의 글 · 댓글 · 인사가 모든 게시판에서 안 보여요.`, [
      { text: '취소', style: 'cancel' },
      { text: '차단', style: 'destructive', onPress: async () => {
        try { await api.blockUser(t.author.userId); t.onBlocked(); }
        catch (e: any) { if (!e?._handled) Alert.alert('차단하지 못했어요', e?.message ?? '다시 시도해 주세요.'); }
      } },
    ]);
  };

  const run = (action: Action, t: MenuTarget) => {
    if (action === 'edit') t.onEdit?.();
    else if (action === 'delete') remove(t);
    else if (action === 'report') setReporting(t);
    else block(t);
  };

  const element = (
    <>
      <BottomSheet visible={!!target} onClose={() => setTarget(null)} title={target ? `${NOUN[target.type]} 메뉴` : ''} items={items} fitContent
        // 시트가 닫히는 애니메이션(250ms)이 끝난 뒤 다음 창을 엶
        onSelect={(action: Action) => { const t = target; if (t) setTimeout(() => run(action, t), 260); }} />
      <ReportPopup
        visible={!!reporting}
        title={reporting ? `${NOUN[reporting.type]} 신고` : ''}
        onClose={() => setReporting(null)}
        onSubmit={async (reason, memo) => {
          if (!reporting) return;
          try {
            await api.reportCommunity({ targetType: reporting.type, targetId: reporting.id, reason, memo });
            setReporting(null);
            Alert.alert('신고했어요', '관리자가 확인할게요.');
          } catch (e: any) {
            if (e?.code === 'ALREADY') { setReporting(null); Alert.alert('이미 신고했어요'); }
            else if (!e?._handled) Alert.alert('신고하지 못했어요', e?.message ?? '다시 시도해 주세요.');
          }
        }}
      />
    </>
  );
  return { open: setTarget, element };
}
