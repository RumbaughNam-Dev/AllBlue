import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, setScheduleChangedHandler, type Schedule } from '@/services/api';
import type { DiveActivityProps } from './DiveActivity';
import { DiveLiveUpdate } from '@/modules/dive-live-update';

// 다가오는 다이빙 라이브 액티비티 (iOS 16.2+, expo-widgets) · Live Update (안드로이드, modules/dive-live-update) — 1.0.5 스토어 빌드부터.
// 앱이 다가오는 일정(홈 API의 upcoming, 내가 만든 · 수락한 일정)을 받을 때마다 맞춰 띄우고 · 고치고 · 끔.
// - 시작 6시간 전부터 띄움: iOS는 라이브 액티비티를 최대 8시간만 켜 둬서 12시간 전에 띄우면 시작 전에 꺼짐
// - 시작 시각에 '다이빙 시작!'으로 바뀌고(staleDate), 시작 30분 뒤 앱이 다시 열리면 내림
// - 그 사이 앱을 한 번도 안 열면 안 뜸 (서버 푸시로 띄우기는 다음 단계)
const SHOW_BEFORE_MS = 6 * 60 * 60 * 1000;
const KEEP_AFTER_MS = 30 * 60 * 1000;
const STORE_KEY = 'dive-live-activity'; // { activityId, scheduleId, signature, shownAt }

type Saved = { activityId: string; scheduleId: number; signature: string; shownAt: number };
type Factory = typeof import('./DiveActivity').default;

// 옛 바이너리(1.0.4 이하)엔 네이티브 모듈이 없어서 불러오기만 해도 오류 → 있을 때만 씀
let factory: Factory | null | undefined;
function getFactory(): Factory | null {
  if (factory !== undefined) return factory;
  if (Platform.OS !== 'ios') return (factory = null);
  try {
    factory = require('./DiveActivity').default as Factory;
  } catch {
    factory = null;
  }
  return factory;
}

// 일정 날짜 · 시각은 한국 시간
export function scheduleStart(s: Pick<Schedule, 'scheduleDate' | 'startHour' | 'startMinute'>) {
  const ymd = s.scheduleDate.slice(0, 10);
  const hh = String(s.startHour).padStart(2, '0');
  const mm = String(s.startMinute).padStart(2, '0');
  return new Date(`${ymd}T${hh}:${mm}:00+09:00`).getTime();
}

function timeLabel(start: number) {
  const k = new Date(start + 9 * 3600_000);
  const h = k.getUTCHours(), m = k.getUTCMinutes();
  return `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')}`;
}

function dayLabel(start: number, now: number) {
  const day = (t: number) => Math.floor((t + 9 * 3600_000) / 86_400_000);
  const diff = day(start) - day(now);
  return diff <= 0 ? '오늘' : diff === 1 ? '내일' : `${diff}일 뒤`;
}

function propsFor(s: Schedule, now: number, shownAt: number): DiveActivityProps {
  const start = scheduleStart(s);
  return {
    scheduleId: s.id,
    title: s.title,
    place: s.customLocation || s.poolName || '',
    timeLabel: timeLabel(start),
    dayLabel: dayLabel(start, now),
    category: s.categoryName || '',
    people: s.participantCount ?? 0,
    startAt: start,
    shownAt,
    started: now >= start,
  };
}

// 바뀌면 다시 그려야 하는 값만 (shownAt · dayLabel 제외)
const signatureOf = (p: DiveActivityProps) => JSON.stringify([p.title, p.place, p.timeLabel, p.category, p.people, p.startAt, !!p.started]);

async function readSaved(): Promise<Saved | null> {
  try { return JSON.parse((await AsyncStorage.getItem(STORE_KEY)) ?? 'null'); } catch { return null; }
}
const writeSaved = (v: Saved | null) =>
  (v ? AsyncStorage.setItem(STORE_KEY, JSON.stringify(v)) : AsyncStorage.removeItem(STORE_KEY)).catch(() => {});

let running: Promise<void> | null = null;
let queued: Schedule[] | null = null;

// upcoming: 시작 시각이 빠른 순 (홈 API 그대로). 로그아웃이면 []를 넘겨 모두 내림
export function syncDiveActivity(upcoming: Schedule[]): Promise<void> {
  if (running) { queued = upcoming; return running; }
  running = run(upcoming).catch(() => {}).finally(() => {
    running = null;
    if (queued) { const next = queued; queued = null; void syncDiveActivity(next); }
  });
  return running;
}

function pickTarget(upcoming: Schedule[], now: number) {
  return upcoming
    .map(s => ({ s, start: scheduleStart(s) }))
    .filter(x => Number.isFinite(x.start) && x.start - now <= SHOW_BEFORE_MS && now - x.start <= KEEP_AFTER_MS)
    .sort((a, b) => a.start - b.start)[0];
}

// 안드로이드: 알림 하나를 같은 id로 띄우고 · 고치고 · 지움 (남은 시간 · 시작 30분 뒤 지우기는 시스템이)
async function runAndroid(upcoming: Schedule[]) {
  const native = DiveLiveUpdate;
  if (!native) return;
  const now = Date.now();
  const target = pickTarget(upcoming, now);
  const saved = await readSaved();
  if (!target) {
    if (saved) { native.end(); await writeSaved(null); }
    return;
  }
  const { shownAt: _shownAt, ...props } = propsFor(target.s, now, now);
  const signature = signatureOf(propsFor(target.s, now, now));
  if (saved?.scheduleId === target.s.id && saved.signature === signature) return;
  if (!native.canPost()) return;
  if (native.show(props)) await writeSaved({ activityId: 'android', scheduleId: target.s.id, signature, shownAt: now });
}

async function run(upcoming: Schedule[]) {
  if (Platform.OS === 'android') return runAndroid(upcoming);
  const f = getFactory();
  if (!f) return;
  const now = Date.now();
  const target = pickTarget(upcoming, now);

  const instances = f.getInstances();
  const saved = await readSaved();
  const mine = saved ? instances.find(i => i.getId() === saved.activityId) : undefined;

  // 띄울 일정이 없거나 다른 일정이면: 지금 떠 있는 것 모두 내림
  if (!target || !mine || saved?.scheduleId !== target.s.id) {
    await Promise.all(instances.map(i => i.end('immediate').catch(() => {})));
    if (!target) { await writeSaved(null); return; }
    const props = propsFor(target.s, now, now);
    const activity = f.start(props, `allblue://schedule-detail?id=${target.s.id}`, new Date(props.startAt));
    await writeSaved({ activityId: activity.getId(), scheduleId: target.s.id, signature: signatureOf(props), shownAt: now });
    return;
  }

  // 같은 일정: 시간 · 장소 · 제목 · 인원이 바뀌었으면 고침 (남은 시간은 저절로 줄어듦)
  const props = propsFor(target.s, now, saved.shownAt ?? now);
  if (signatureOf(props) !== saved.signature) {
    await mine.update(props, new Date(props.startAt));
    await writeSaved({ ...saved, signature: signatureOf(props) });
  }
  // 다른 일정의 남은 것 정리
  await Promise.all(instances.filter(i => i !== mine).map(i => i.end('immediate').catch(() => {})));
}

// 홈 API를 새로 받아 맞춤 (앱으로 돌아올 때 · 일정이 바뀐 뒤)
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
export function refreshDiveActivity(delay = 0) {
  if (!getFactory() && !DiveLiveUpdate) return;
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    api.getHome().then(home => syncDiveActivity(home.upcoming)).catch(() => {});
  }, delay);
}

setScheduleChangedHandler(() => refreshDiveActivity(500));
