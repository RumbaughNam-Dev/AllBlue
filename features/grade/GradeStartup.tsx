import { useEffect } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { localDay } from '@/features/notices/types';
import { gradeOf } from './grade';
import {
  claimAwards, clearMyGrade, noticesIdle, openQuests, pushXpEvents, refreshQuestStatus, setMyGrade, waitFor, xpQueueEmpty,
} from './store';

// 앱을 새로 켰을 때 (회원마다 이 실행에서 한 번만 — 백그라운드에서 돌아올 땐 안 함):
// 1) 처음이면 배지 화면(회원당 한 번) 2) 그날 처음 켰으면 퀘스트 화면 (공지 팝업 · 배지가 끝난 뒤) 3) 못 본 경험치 애니메이션
const started = new Set<string>();

export default function GradeStartup({ userId }: { userId: string }) {
  useEffect(() => {
    let alive = true;
    if (!started.has(userId)) {
      started.add(userId);
      (async () => {
        try {
          const s = await refreshQuestStatus();
          if (!alive) return;
          setMyGrade(userId, s.totalXp);
          if (!s.introSeen) pushXpEvents([{ kind: 'grade', grade: gradeOf(s.totalXp), intro: true }]);
          const key = `quest-popup-day:${userId}`;
          const today = localDay();
          if ((await AsyncStorage.getItem(key)) !== today) {
            await waitFor(() => noticesIdle() && xpQueueEmpty());
            if (!alive) return;
            await AsyncStorage.setItem(key, today).catch(() => {});
            openQuests();
          }
          void claimAwards();
        } catch { /* 옛 서버 · 오프라인: 등급 표시 없이 그대로 */ }
      })();
    }
    // 앱으로 돌아오면 빨간 점 · 다른 기기에서 받은 경험치만 새로 (퀘스트 화면은 다시 안 띄움)
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') { refreshQuestStatus().catch(() => {}); void claimAwards(); }
    });
    return () => { alive = false; sub.remove(); };
  }, [userId]);

  useEffect(() => () => clearMyGrade(), []);
  return null;
}
