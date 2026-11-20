import AsyncStorage from '@react-native-async-storage/async-storage';
import {api} from '@/services/api';

export interface Session {
  id: string;
  startTime: number;
  lapTimes: number[];
  duration: number;
}

// 세션 기록은 서버(game_record, game 'apneatap')에 저장 (2026-11-20, A-Tap 앱은 기기에만 저장했음).
// 설정(시간 표시 · 진동 및 사운드)만 이 기기에 남김
type NewSession = Omit<Session, 'id'>;

export async function loadSessions(): Promise<Session[]> {
  const {records} = await api.getAllApneaTapRecords();
  return records.map(r => ({id: String(r.id), ...r.details}));
}

export async function saveSession(session: NewSession): Promise<Session> {
  const {record} = await api.saveGameRecord('apneatap', {score: 0, details: session});
  return {id: String(record.id), ...record.details};
}

export async function deleteSession(id: string): Promise<void> {
  await api.deleteApneaTapRecord(Number(id));
}

// Settings
export interface AppSettings {
  showTimer: boolean;
  hapticSound: boolean;
}

const SETTINGS_KEY = '@atap_settings';

export async function loadSettings(): Promise<AppSettings> {
  const json = await AsyncStorage.getItem(SETTINGS_KEY);
  return json ? JSON.parse(json) : {showTimer: true, hapticSound: false};
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
