import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Session {
  id: string;
  startTime: number;
  lapTimes: number[];
  duration: number;
}

const KEY = '@atap_sessions';

export async function loadSessions(): Promise<Session[]> {
  const json = await AsyncStorage.getItem(KEY);
  return json ? JSON.parse(json) : [];
}

export async function saveSession(session: Session): Promise<void> {
  const sessions = await loadSessions();
  sessions.unshift(session);
  await AsyncStorage.setItem(KEY, JSON.stringify(sessions));
}

export async function deleteSession(id: string): Promise<void> {
  const sessions = await loadSessions();
  const filtered = sessions.filter(s => s.id !== id);
  await AsyncStorage.setItem(KEY, JSON.stringify(filtered));
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
