import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Alert,
  Animated,
  BackHandler,
  Dimensions,
  PanResponder,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {StatusBar} from 'expo-status-bar';
import {useRouter} from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import HomeScreen from './screens/HomeScreen';
import ReadyScreen from './screens/ReadyScreen';
import SessionScreen, {SessionData} from './screens/SessionScreen';
import CompleteScreen from './screens/CompleteScreen';
import RecordsScreen from './screens/RecordsScreen';
import {
  Session,
  AppSettings,
  loadSessions,
  saveSession,
  deleteSession,
  loadSettings,
  saveSettings,
} from './storage/sessions';

// ApneaTap (따로 출시한 A-Tap 앱, ApneaTapExpo의 App.tsx)을 AllBlue 게임으로 옮김 (2026-11-20 사용자 요청).
// 바뀐 점: 3초 스플래시 없이 바로 홈, 홈 왼쪽 위 X로 AllBlue로 돌아감, 안드로이드 뒤로 버튼 처리.
// 기록은 서버에 저장 (2026-11-20, 사용자별 game_record 'apneatap') — A-Tap 앱의 기기 기록은 다른 앱이라 가져올 수 없음.
// 저장 · 지우기가 안 되면 알림만 띄우고 화면은 그대로 진행

const {width: SCREEN_W} = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_W * 0.3;
const FADE_DURATION = 400;

type Screen = 'home' | 'ready' | 'session' | 'complete';

export default function ApneaTapGame() {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>('home');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    showTimer: true,
    hapticSound: false,
  });
  const [lastSession, setLastSession] = useState<Session | null>(null);
  const [recordsVisible, setRecordsVisible] = useState(false);
  const recordsSlide = useRef(new Animated.Value(SCREEN_W)).current;
  const closeRecordsRef = useRef<(() => void) | undefined>(undefined);
  const detailOpenRef = useRef(false);

  const homeOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(homeOpacity, {
      toValue: 1,
      duration: FADE_DURATION,
      useNativeDriver: true,
    }).start();
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    loadSessions().then(setSessions).catch(() => {
      Alert.alert('기록을 불러오지 못했어요', '인터넷 연결을 확인한 뒤 기록조회를 다시 열어 주세요.');
    });
    loadSettings().then(setSettings).catch(() => {});
  }, [homeOpacity]);

  const handleSettingsChange = useCallback(async (newSettings: AppSettings) => {
    setSettings(newSettings);
    try {
      await saveSettings(newSettings);
    } catch {
      // Storage save failed — settings applied in-memory only
    }
  }, []);

  const handleSessionComplete = useCallback(async (data: SessionData) => {
    const draft = {
      startTime: data.startTime,
      lapTimes: data.lapTimes,
      duration: data.duration,
    };
    let session: Session = {id: `local-${data.startTime}`, ...draft};
    try {
      session = await saveSession(draft);
      setSessions(prev => [session, ...prev]);
    } catch {
      Alert.alert('기록을 저장하지 못했어요', '인터넷 연결을 확인해 주세요. 이번 결과는 화면에만 보여요.');
    }
    setLastSession(session);
    setScreen('complete');
  }, []);

  // 기록조회를 열 때마다 서버에서 다시 받아 옴 (다른 기기에서 한 세션도 보이게)
  const openRecords = useCallback(() => {
    setRecordsVisible(true);
    loadSessions().then(setSessions).catch(() => {
      Alert.alert('기록을 불러오지 못했어요', '인터넷 연결을 확인해 주세요.');
    });
  }, []);

  const closeRecords = useCallback(() => {
    Animated.timing(recordsSlide, {
      toValue: SCREEN_W,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setRecordsVisible(false));
  }, [recordsSlide]);

  closeRecordsRef.current = closeRecords;

  const goHome = useCallback(() => {
    homeOpacity.setValue(1);
    setScreen('home');
  }, [homeOpacity]);

  // 안드로이드 뒤로 버튼: 기록 → 닫기, 준비 · 완료 → 홈, 세션 중엔 무시, 홈이면 AllBlue로 (기본 동작)
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (recordsVisible) {
        if (!detailOpenRef.current) closeRecordsRef.current?.();
        return true;
      }
      if (screen === 'session') return true;
      if (screen !== 'home') {
        goHome();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [recordsVisible, screen, goHome]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
    } catch {
      Alert.alert('기록을 지우지 못했어요', '인터넷 연결을 확인한 뒤 다시 해 주세요.');
    }
  }, []);

  useEffect(() => {
    if (recordsVisible) {
      recordsSlide.setValue(SCREEN_W);
      requestAnimationFrame(() => {
        Animated.spring(recordsSlide, {
          toValue: 0,
          friction: 9,
          tension: 65,
          useNativeDriver: true,
        }).start();
      });
    }
  }, [recordsVisible, recordsSlide]);

  const recordsPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (e, gs) =>
        !detailOpenRef.current &&
        e.nativeEvent.pageX - gs.dx <= 30 &&
        gs.dx > 15 &&
        Math.abs(gs.dx) > Math.abs(gs.dy * 2),
      onPanResponderMove: (_, gs) => {
        if (gs.dx > 0) {
          recordsSlide.setValue(gs.dx);
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx > SWIPE_THRESHOLD || gs.vx > 0.5) {
          closeRecordsRef.current?.();
        } else {
          Animated.spring(recordsSlide, {
            toValue: 0,
            friction: 9,
            tension: 65,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  const backdropOpacity = recordsSlide.interpolate({
    inputRange: [0, SCREEN_W],
    outputRange: [0.5, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {screen === 'home' && (
        <Animated.View style={[styles.screenFill, {opacity: homeOpacity}]}>
          <HomeScreen
            onStart={() => setScreen('ready')}
            onRecords={openRecords}
            onExit={() => router.back()}
          />
        </Animated.View>
      )}
      {screen === 'ready' && (
        <ReadyScreen
          onStart={() => setScreen('session')}
          onBack={goHome}
          settings={settings}
          onSettingsChange={handleSettingsChange}
        />
      )}
      {screen === 'session' && (
        <SessionScreen
          onComplete={handleSessionComplete}
          settings={settings}
        />
      )}
      {screen === 'complete' && lastSession && (
        <CompleteScreen session={lastSession} onFinish={goHome} />
      )}

      {recordsVisible && (
        <>
          <Animated.View style={[styles.backdrop, {opacity: backdropOpacity}]}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={closeRecords}
            />
          </Animated.View>
          <Animated.View
            style={[
              styles.recordsPanel,
              {transform: [{translateX: recordsSlide}]},
            ]}
            {...recordsPan.panHandlers}>
            <RecordsScreen
              sessions={sessions}
              onBack={closeRecords}
              onDetailOpenChange={(open: boolean) => {
                detailOpenRef.current = open;
              }}
              onDelete={handleDelete}
            />
          </Animated.View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0B1929',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000',
  },
  screenFill: {
    flex: 1,
  },
  recordsPanel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: SCREEN_W,
    backgroundColor: '#0B1929',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {width: -4, height: 0},
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 16,
      },
    }),
  },
});
