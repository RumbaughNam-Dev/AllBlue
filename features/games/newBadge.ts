import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 게임 아이콘의 NEW 배지: 게임 고르기 팝업을 한 번 열면 사라짐 (이 기기 기준).
// 게임이 새로 늘면 LATEST_GAME만 바꾸면 다시 보임
export const LATEST_GAME = 'freediving';
const KEY = 'games-new-seen';

export function useNewGameBadge() {
  const [isNew, setIsNew] = useState(false);
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(KEY)
      .then(seen => { if (alive) setIsNew(seen !== LATEST_GAME); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  const markSeen = useCallback(() => {
    setIsNew(false);
    void AsyncStorage.setItem(KEY, LATEST_GAME).catch(() => {});
  }, []);
  return { isNew, markSeen };
}
