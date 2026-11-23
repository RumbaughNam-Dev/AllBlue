import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

// 다이빙 만들기 · 수정의 한 항목씩 입력하는 순서 (2026-11-23).
// 마지막은 교육생/참석자 입력 화면. 트레이닝 칸(최대 인원 · 비용)은 강사가 트레이닝을 고를 때만,
// 비용은 최대 인원을 넣었을 때만 나옴. 날짜는 만들 때만 (수정에서는 원래도 못 바꿈)
export type FlowKey = 'title' | 'place' | 'date' | 'time' | 'category' | 'capacity' | 'fee' | 'visibility' | 'participants';

export function useEditorFlow({ isEditMode, canOpenTraining, hasCapacity, step, setStep, enterParticipants, validate }: {
  isEditMode: boolean;
  canOpenTraining: boolean;
  hasCapacity: boolean;
  step: 'info' | 'participant';
  setStep: (step: 'info' | 'participant') => void;
  enterParticipants: () => void;
  validate: (key: FlowKey) => string | null;
}) {
  const order: FlowKey[] = [
    'title', 'place', ...(isEditMode ? [] : ['date' as const]), 'time', 'category',
    ...(canOpenTraining ? ['capacity' as const, ...(hasCapacity ? ['fee' as const] : [])] : []),
    'visibility', 'participants',
  ];
  const [active, setActive] = useState<FlowKey>('title');
  // 입력을 마친 항목. 수정할 때는 처음부터 모두 마친 것으로 보고, 고친 뒤 '다음'이면 바로 참석자 화면으로
  const [done, setDone] = useState<Set<FlowKey>>(new Set());
  const isDone = (key: FlowKey) => isEditMode || done.has(key);
  const current: FlowKey = step === 'participant' ? 'participants' : order.includes(active) ? active : 'title';

  const next = () => {
    if (step === 'participant') return;
    const message = validate(current);
    if (message) { Alert.alert('알림', message); return; }
    const nextDone = new Set(done).add(current);
    setDone(nextDone);
    const following = order.slice(order.indexOf(current) + 1).find(key => !(isEditMode || nextDone.has(key))) ?? 'participants';
    if (following === 'participants') enterParticipants();
    else setActive(following);
  };

  // 장소 · 날짜 · 분류처럼 고르면 끝나는 항목은 고른 값이 화면에 반영된 다음 넘어감
  const [advanceTick, setAdvanceTick] = useState(0);
  const advanceSoon = () => setAdvanceTick(tick => tick + 1);
  useEffect(() => {
    if (!advanceTick) return;
    const timer = setTimeout(next, 220);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advanceTick]);

  const edit = (key: FlowKey) => {
    if (step === 'participant') setStep('info');
    setActive(key);
  };

  return {
    current,
    total: order.length,
    position: (key: FlowKey) => order.indexOf(key) + 1,
    // 지금 입력 중인 카드 아래에 쌓이는 끝난 카드 (가장 최근 것이 위)
    doneKeys: order.filter(key => key !== 'participants' && key !== current && isDone(key)).reverse(),
    next, advanceSoon, edit,
  };
}
