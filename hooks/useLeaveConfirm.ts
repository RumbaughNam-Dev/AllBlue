import { useEffect } from 'react';
import { Alert, BackHandler } from 'react-native';
import { usePreventRemove } from 'expo-router';
import { useIsInPane } from '@/features/split/SplitPane';

export function confirmLeave(onLeave: () => void) {
  Alert.alert('저장하지 않고 나갈까요?', '바꾼 내용이 사라져요.', [
    { text: '취소', style: 'cancel' },
    { text: '나가기', style: 'destructive', onPress: onLeave },
  ]);
}

// 25장: 바꾼 내용이 있는 편집 화면을 떠나기 전에 확인.
// 스택 화면은 취소 · 뒤로 버튼, 안드로이드 뒤로가기, 아이폰 밀어서 뒤로를 모두 막고,
// 펼친 화면 오른쪽(pane)은 화면의 뒤로 버튼과 안드로이드 뒤로가기를 막음.
// 돌려주는 함수를 화면의 취소 · 뒤로 버튼에 연결.
export function useLeaveConfirm(dirty: boolean, back: () => void) {
  const inPane = useIsInPane();
  const disablePrevention = usePreventRemove(dirty && !inPane, ({ repeat }) => {
    confirmLeave(() => { disablePrevention(); repeat(); });
  });
  useEffect(() => {
    if (!dirty || !inPane) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { confirmLeave(back); return true; });
    return () => sub.remove();
  }, [dirty, inPane, back]);
  return () => (dirty && inPane ? confirmLeave(back) : back());
}
