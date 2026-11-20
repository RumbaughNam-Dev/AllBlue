import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Animated,
  GestureResponderEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import SparkleEffect from '../components/SparkleEffect';
import PopBurst, {BurstData} from '../components/PopBurst';
import LongPressGauge from '../components/LongPressGauge';
import {AppSettings} from '../storage/sessions';
import {
  tapFeedback,
  startBuzzFeedback,
  completeFeedback,
  stopBuzzFeedback,
} from '../utils/feedback';

export interface SessionData {
  startTime: number;
  lapTimes: number[];
  duration: number;
}

interface Props {
  onComplete: (data: SessionData) => void;
  settings: AppSettings;
}

function formatTime(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  const cs = Math.floor((ms % 1000) / 10);
  return `${min.toString().padStart(2, '0')}:${sec
    .toString()
    .padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
}

export default function SessionScreen({onComplete, settings}: Props) {
  const startTimeRef = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [displayElapsed, setDisplayElapsed] = useState(0);
  const pressingRef = useRef(false);
  const frozenTimeRef = useRef(0);
  const [lapTimes, setLapTimes] = useState<number[]>([]);
  const lapTimesRef = useRef<number[]>([]);
  const flashAnim = useRef(new Animated.Value(0)).current;
  const lapScaleAnim = useRef(new Animated.Value(0)).current;
  const [lastLap, setLastLap] = useState<string | null>(null);
  const longPressStartRef = useRef<number | null>(null);
  const buzzStartedRef = useRef(false);
  const [bursts, setBursts] = useState<BurstData[]>([]);
  const burstIdRef = useRef(0);
  const lastTapPosRef = useRef({x: 0, y: 0});
  const [gaugeVisible, setGaugeVisible] = useState(false);
  const [gaugePos, setGaugePos] = useState({x: 0, y: 0});

  useEffect(() => {
    lapTimesRef.current = lapTimes;
  }, [lapTimes]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now() - startTimeRef.current;
      setElapsed(now);
      setDisplayElapsed(now);
    }, 16);
    return () => {
      clearInterval(interval);
      stopBuzzFeedback();
    };
  }, []);

  // Clean up each burst individually after its animation completes
  const burstTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  useEffect(() => {
    bursts.forEach(b => {
      if (!burstTimers.current.has(b.id)) {
        const timer = setTimeout(() => {
          setBursts(prev => prev.filter(burst => burst.id !== b.id));
          burstTimers.current.delete(b.id);
        }, 1200);
        burstTimers.current.set(b.id, timer);
      }
    });
  }, [bursts]);

  useEffect(() => {
    const timers = burstTimers.current;
    return () => {
      timers.forEach(t => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const completedRef = useRef(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finishSession = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    if (buzzStartedRef.current) {
      stopBuzzFeedback();
      buzzStartedRef.current = false;
    }
    if (settings.hapticSound) {
      completeFeedback();
    }
    const duration = (longPressStartRef.current ?? Date.now()) - startTimeRef.current;
    onComplete({
      startTime: startTimeRef.current,
      lapTimes: lapTimesRef.current,
      duration,
    });
  }, [onComplete, settings.hapticSound]);

  const gaugeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePressIn = useCallback(
    (e: GestureResponderEvent) => {
      lastTapPosRef.current = {
        x: e.nativeEvent.pageX,
        y: e.nativeEvent.pageY,
      };
      longPressStartRef.current = Date.now();
      buzzStartedRef.current = false;
      pressingRef.current = true;
      frozenTimeRef.current = Date.now() - startTimeRef.current;

      // 0.5초 후 롱프레스 인지 → 게이지 표시 + 진동 시작
      gaugeTimerRef.current = setTimeout(() => {
        if (longPressStartRef.current !== null) {
          setGaugePos({x: lastTapPosRef.current.x, y: lastTapPosRef.current.y});
          setGaugeVisible(true);
          if (settings.hapticSound) {
            buzzStartedRef.current = true;
            startBuzzFeedback();
          }
        }
      }, 500);

      // 2.5초 후 자동 종료 (0.5초 인지 + 2초 게이지)
      longPressTimerRef.current = setTimeout(() => {
        setGaugeVisible(false);
        finishSession();
      }, 2500);
    },
    [settings.hapticSound, finishSession],
  );

  const handlePressOut = useCallback(() => {
    // 타이머 취소
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (gaugeTimerRef.current) {
      clearTimeout(gaugeTimerRef.current);
      gaugeTimerRef.current = null;
    }

    setGaugeVisible(false);

    if (buzzStartedRef.current) {
      stopBuzzFeedback();
    }

    const pressDuration = longPressStartRef.current
      ? Date.now() - longPressStartRef.current
      : 0;

    if (pressDuration >= 500 && !completedRef.current) {
      // Long press (>= 0.5s) → end session
      finishSession();
    } else if (!completedRef.current) {
      // Short tap → record lap + burst (use saved position)
      const lapTime = Date.now() - startTimeRef.current;
      setLapTimes(prev => [...prev, lapTime]);
      setLastLap(formatTime(lapTime));

      burstIdRef.current += 1;
      setBursts(prev => [
        ...prev,
        {x: lastTapPosRef.current.x, y: lastTapPosRef.current.y, id: burstIdRef.current},
      ]);

      if (settings.hapticSound) {
        tapFeedback();
      }

      flashAnim.setValue(0.3);
      Animated.timing(flashAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start();

      lapScaleAnim.setValue(1.5);
      Animated.spring(lapScaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 80,
        useNativeDriver: true,
      }).start();
    }

    longPressStartRef.current = null;
    buzzStartedRef.current = false;
    pressingRef.current = false;
    setDisplayElapsed(Date.now() - startTimeRef.current);
  }, [flashAnim, lapScaleAnim, settings.hapticSound, finishSession]);

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.pressable}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}>
        <SparkleEffect color="rgba(56, 189, 248, 0.6)" />

        <View style={styles.timerBox}>
          {settings.showTimer ? (
            <Text style={styles.timer}>{formatTime(displayElapsed)}</Text>
          ) : (
            <Text style={styles.timerHidden}>안보이도록 설정되었어요.</Text>
          )}
        </View>

        {lapTimes.length > 0 && (
          <Animated.Text
            style={[
              styles.lastLapFlash,
              {transform: [{scale: lapScaleAnim}]},
            ]}>
            {lapTimes.length}회
          </Animated.Text>
        )}

        <Animated.View
          style={[styles.flashOverlay, {opacity: flashAnim}]}
          pointerEvents="none"
        />

        <View style={styles.hintContainer}>
          <Text style={styles.hint}>tap 기록 · long press 종료</Text>
        </View>
      </Pressable>

      <PopBurst bursts={bursts} />
      <LongPressGauge
        x={gaugePos.x}
        y={gaugePos.y}
        visible={gaugeVisible}
        duration={2000}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1929',
  },
  pressable: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
  },
  timerBox: {
    marginTop: 120,
    alignItems: 'center',
  },
  timer: {
    color: '#E2E8F0',
    fontSize: 64,
    fontWeight: '200',
    letterSpacing: 4,
    ...Platform.select({
      ios: {fontFamily: 'Avenir Next'},
      android: {fontFamily: 'sans-serif-thin'},
    }),
    textShadowColor: 'rgba(14, 165, 233, 0.3)',
    textShadowOffset: {width: 0, height: 2},
    textShadowRadius: 10,
  },
  timerHidden: {
    color: '#64748B',
    fontSize: 18,
    fontWeight: '500',
    letterSpacing: 1,
    ...Platform.select({
      ios: {fontFamily: 'Avenir Next'},
      android: {fontFamily: 'sans-serif'},
    }),
  },
  lastLapFlash: {
    marginTop: 30,
    color: '#38BDF8',
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: 2,
    textShadowColor: 'rgba(56, 189, 248, 0.5)',
    textShadowOffset: {width: 0, height: 0},
    textShadowRadius: 12,
  },
  lapContainer: {
    position: 'absolute',
    bottom: 100,
    alignItems: 'center',
  },
  flashOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  hintContainer: {
    position: 'absolute',
    bottom: 50,
  },
  hint: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: 1,
  },
});
