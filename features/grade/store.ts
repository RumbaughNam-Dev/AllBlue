import { useEffect, useSyncExternalStore } from 'react';
import { api, setQuestActionHandler } from '@/services/api';
import { Grade, gradeOf } from './grade';

// 등급 · 퀘스트 상태 (앱 전체 하나): 내 등급, 다른 회원 등급 캐시, 경험치 애니메이션 차례, 퀘스트 화면 열림

type Listener = () => void;
function signal<T>(initial: T) {
  let value = initial;
  const listeners = new Set<Listener>();
  return {
    get: () => value,
    set: (next: T) => { value = next; listeners.forEach(l => l()); },
    subscribe: (l: Listener) => { listeners.add(l); return () => { listeners.delete(l); }; },
  };
}

// ── 내 등급 ──
const me = signal<{ userId: string | null; totalXp: number | null }>({ userId: null, totalXp: null });
// 애니메이션이 남아 있는 동안 내 테두리 · 레벨은 애니메이션이 도착한 만큼만 (등급이 먼저 바뀌어 보이지 않게)
const shownXp = signal<number | null>(null);
export const setShownXp = (v: number | null) => shownXp.set(v);
const myXp = (s: { totalXp: number | null }) => shownXp.get() ?? s.totalXp;
export function setMyGrade(userId: string, totalXp: number) {
  me.set({ userId, totalXp });
  others.set(userId, totalXp);
  bumpOthers();
}
export function clearMyGrade() { me.set({ userId: null, totalXp: null }); }
export const myGradeState = () => me.get();
export function useMyGrade(): Grade | null {
  const s = useSyncExternalStore(me.subscribe, me.get);
  useSyncExternalStore(shownXp.subscribe, shownXp.get);
  const xp = myXp(s);
  return xp == null ? null : gradeOf(xp);
}

// ── 다른 회원 등급: 화면에 나온 아이디를 50ms 모아 한 번에 받고 10분 캐시 ──
const others = new Map<string, number>();
const fetchedAt = new Map<string, number>();
const pending = new Set<string>();
const version = signal(0);
const bumpOthers = () => version.set(version.get() + 1);
let timer: ReturnType<typeof setTimeout> | null = null;
const TTL = 10 * 60 * 1000;

function flush() {
  timer = null;
  const ids = [...pending].slice(0, 200);
  ids.forEach(id => pending.delete(id));
  if (!ids.length) return;
  api.getGrades(ids).then(res => {
    const now = Date.now();
    ids.forEach(id => { others.set(id, res.grades[id] ?? 0); fetchedAt.set(id, now); });
    const mine = me.get();
    if (mine.userId && mine.totalXp != null) others.set(mine.userId, mine.totalXp); // 내 것은 퀘스트에서 받은 값이 더 새로움
    bumpOthers();
  }).catch(() => { /* 서버가 아직 옛 버전이거나 오프라인: 테두리는 기본(프린이)으로 */ });
  if (pending.size) timer = setTimeout(flush, 50);
}
function want(userId: string) {
  const at = fetchedAt.get(userId);
  if (at && Date.now() - at < TTL) return;
  if (pending.has(userId)) return;
  fetchedAt.set(userId, Date.now()); // 실패해도 10분 동안 다시 안 물음
  pending.add(userId);
  if (!timer) timer = setTimeout(flush, 50);
}

// 회원 아이디(로그인 아이디)로 등급. 모르면 null (받는 동안), 게스트 · 임시 회원은 userId 없이 부르면 null
export function useUserGrade(userId?: string | null): Grade | null {
  useSyncExternalStore(version.subscribe, version.get);
  const mine = useSyncExternalStore(me.subscribe, me.get);
  useSyncExternalStore(shownXp.subscribe, shownXp.get);
  useEffect(() => { if (userId && userId !== mine.userId) want(userId); }, [userId, mine.userId]);
  if (!userId) return null;
  const myTotal = myXp(mine);
  if (userId === mine.userId && myTotal != null) return gradeOf(myTotal);
  const xp = others.get(userId);
  return xp == null ? null : gradeOf(xp);
}

// ── 퀘스트 화면 열기 ──
const questOpen = signal(false);
export const openQuests = () => questOpen.set(true);
export const closeQuests = () => questOpen.set(false);
export const useQuestsOpen = () => useSyncExternalStore(questOpen.subscribe, questOpen.get);

// 홈 퀘스트 아이콘 빨간 점: 오늘 남은 일간 퀘스트가 있음
const dailyLeft = signal(false);
export const setDailyLeft = (v: boolean) => dailyLeft.set(v);
export const useDailyLeft = () => useSyncExternalStore(dailyLeft.subscribe, dailyLeft.get);

// ── 경험치 애니메이션 차례 ──
export type XpEvent =
  | { kind: 'xp'; name: string; xp: number; before: Grade; after: Grade }
  | { kind: 'grade'; grade: Grade; intro: boolean };
const queue = signal<XpEvent[]>([]);
export const useXpQueue = () => useSyncExternalStore(queue.subscribe, queue.get);
export const pushXpEvents = (events: XpEvent[]) => { if (events.length) queue.set([...queue.get(), ...events]); };
export const shiftXpEvent = () => {
  const [done, ...rest] = queue.get();
  if (done?.kind === 'xp') shownXp.set(done.after.totalXp);
  if (!rest.length) shownXp.set(null);
  queue.set(rest);
};

// 서버가 준 아직 안 본 경험치를 받아 하나씩 애니메이션으로 (퀘스트 · 보너스마다 따로, 등급이 오르면 새 배지 화면)
let claiming: Promise<void> | null = null;
let again = false;
export function claimAwards(): Promise<void> {
  if (claiming) { again = true; return claiming; }
  claiming = (async () => {
    try {
      const res = await api.claimQuestAwards();
      const mine = me.get();
      if (mine.userId) setMyGrade(mine.userId, res.after.totalXp);
      let running = res.before.totalXp;
      const events: XpEvent[] = [];
      for (const a of res.awards) {
        const before = gradeOf(running);
        running += a.xp;
        const after = gradeOf(running);
        events.push({ kind: 'xp', name: a.name, xp: a.xp, before, after });
        if (after.gradeIndex > before.gradeIndex) events.push({ kind: 'grade', grade: after, intro: false });
      }
      if (events.length && shownXp.get() == null) shownXp.set(res.before.totalXp);
      pushXpEvents(events);
      if (res.awards.length) void refreshQuestStatus();
    } catch { /* 옛 서버 · 오프라인: 다음 기회에 */ }
  })().finally(() => {
    claiming = null;
    if (again) { again = false; void claimAwards(); }
  });
  return claiming;
}

// 퀘스트 현황 (화면 · 빨간 점)
export type QuestStatus = Awaited<ReturnType<typeof api.getQuests>>;
const status = signal<QuestStatus | null>(null);
export const useQuestStatus = () => useSyncExternalStore(status.subscribe, status.get);
export async function refreshQuestStatus() {
  const s = await api.getQuests();
  status.set(s);
  const mine = me.get();
  if (mine.userId) setMyGrade(mine.userId, s.totalXp);
  setDailyLeft(!s.maxed && s.daily.quests.some(q => !q.done));
  return s;
}

// 퀘스트가 걸린 요청(출석인사 · 댓글 · 좋아요 · 게임 기록 · 일정 만들기)이 성공하면 api.ts가 부름
let claimTimer: ReturnType<typeof setTimeout> | null = null;
export function questActionDone() {
  if (!me.get().userId) return;
  if (claimTimer) clearTimeout(claimTimer);
  claimTimer = setTimeout(() => { claimTimer = null; void claimAwards(); }, 250);
}

setQuestActionHandler(questActionDone);

// 퀘스트 화면 '하러 가기' → 게임 고르기 팝업 (홈 툴바가 들고 있음)
const gamePicker = signal(0);
export const requestGamePicker = () => gamePicker.set(gamePicker.get() + 1);
export const useGamePickerRequests = () => useSyncExternalStore(gamePicker.subscribe, gamePicker.get);

// 홈 툴바 프로필 사진 위치 (경험치 · 배지가 빨려 들어갈 곳)
type Rect = { x: number; y: number; width: number; height: number };
let avatarMeasure: (() => Promise<Rect | null>) | null = null;
export const registerAvatarTarget = (fn: (() => Promise<Rect | null>) | null) => { avatarMeasure = fn; };
export const measureAvatarTarget = async () => (avatarMeasure ? avatarMeasure().catch(() => null) : null);

// 시작할 때 공지 팝업이 떠 있는 동안은 퀘스트 화면을 미룸 (모달 두 개가 겹치지 않게)
const noticesBusy = signal(false);
export const setNoticesBusy = (v: boolean) => noticesBusy.set(v);
export const waitFor = (check: () => boolean) => new Promise<void>(resolve => {
  if (check()) return resolve();
  const unsubs: (() => void)[] = [];
  const done = () => { if (check()) { unsubs.forEach(u => u()); resolve(); } };
  unsubs.push(noticesBusy.subscribe(done), queue.subscribe(done));
});
export const noticesIdle = () => !noticesBusy.get();
export const xpQueueEmpty = () => queue.get().length === 0;
