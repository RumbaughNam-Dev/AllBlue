import React, {useEffect, useRef} from 'react';
import {Animated, Dimensions, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Svg, {Circle, Path, Defs, RadialGradient, Stop, G} from 'react-native-svg';
import {Ionicons} from '@expo/vector-icons';

const {width: SCREEN_W, height: SCREEN_H} = Dimensions.get('window');

interface Props {
  onStart: () => void;
  onRecords: () => void;
  onExit: () => void; // AllBlue로 돌아가기 (왼쪽 위 X)
}

const BUBBLE_DATA = [
  {x: SCREEN_W * 0.12, y: SCREEN_H * 0.30, r: 7, baseOpacity: 0.22, driftY: 40, driftX: 12, durationY: 6000, durationX: 4500, durationO: 3500},
  {x: SCREEN_W * 0.85, y: SCREEN_H * 0.20, r: 5, baseOpacity: 0.18, driftY: 35, driftX: 8, durationY: 7000, durationX: 5000, durationO: 4000},
  {x: SCREEN_W * 0.28, y: SCREEN_H * 0.62, r: 10, baseOpacity: 0.14, driftY: 50, driftX: 15, durationY: 8000, durationX: 6000, durationO: 5000},
  {x: SCREEN_W * 0.92, y: SCREEN_H * 0.52, r: 6, baseOpacity: 0.20, driftY: 30, driftX: 10, durationY: 5500, durationX: 4000, durationO: 3800},
  {x: SCREEN_W * 0.68, y: SCREEN_H * 0.78, r: 9, baseOpacity: 0.12, driftY: 45, driftX: 18, durationY: 9000, durationX: 5500, durationO: 4500},
  {x: SCREEN_W * 0.06, y: SCREEN_H * 0.80, r: 4, baseOpacity: 0.25, driftY: 25, driftX: 6, durationY: 5000, durationX: 3800, durationO: 3200},
  {x: SCREEN_W * 0.52, y: SCREEN_H * 0.12, r: 6, baseOpacity: 0.16, driftY: 35, driftX: 14, durationY: 7500, durationX: 5200, durationO: 4200},
  {x: SCREEN_W * 0.38, y: SCREEN_H * 0.88, r: 5, baseOpacity: 0.18, driftY: 28, driftX: 9, durationY: 6500, durationX: 4800, durationO: 3600},
  {x: SCREEN_W * 0.75, y: SCREEN_H * 0.40, r: 4, baseOpacity: 0.20, driftY: 20, driftX: 7, durationY: 5800, durationX: 4200, durationO: 3900},
  {x: SCREEN_W * 0.45, y: SCREEN_H * 0.48, r: 3, baseOpacity: 0.24, driftY: 18, driftX: 5, durationY: 4800, durationX: 3500, durationO: 3000},
];

function Bubble({data}: {data: typeof BUBBLE_DATA[0]}) {
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(data.baseOpacity)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loopY = Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, {toValue: -data.driftY, duration: data.durationY, useNativeDriver: true}),
        Animated.timing(translateY, {toValue: data.driftY * 0.6, duration: data.durationY * 1.1, useNativeDriver: true}),
        Animated.timing(translateY, {toValue: 0, duration: data.durationY * 0.5, useNativeDriver: true}),
      ]),
    );

    const loopX = Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, {toValue: data.driftX, duration: data.durationX, useNativeDriver: true}),
        Animated.timing(translateX, {toValue: -data.driftX, duration: data.durationX * 1.2, useNativeDriver: true}),
        Animated.timing(translateX, {toValue: 0, duration: data.durationX * 0.6, useNativeDriver: true}),
      ]),
    );

    const loopO = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {toValue: data.baseOpacity * 0.2, duration: data.durationO, useNativeDriver: true}),
        Animated.timing(opacity, {toValue: data.baseOpacity, duration: data.durationO * 1.3, useNativeDriver: true}),
      ]),
    );

    const loopS = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {toValue: 1.3, duration: data.durationO * 1.1, useNativeDriver: true}),
        Animated.timing(scale, {toValue: 0.8, duration: data.durationO * 0.9, useNativeDriver: true}),
        Animated.timing(scale, {toValue: 1, duration: data.durationO * 0.5, useNativeDriver: true}),
      ]),
    );

    loopY.start();
    loopX.start();
    loopO.start();
    loopS.start();

    return () => { loopY.stop(); loopX.stop(); loopO.stop(); loopS.stop(); };
  }, [translateY, translateX, opacity, scale, data]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: data.x - data.r,
        top: data.y - data.r,
        width: data.r * 2,
        height: data.r * 2,
        borderRadius: data.r,
        backgroundColor: '#7DD3FC',
        opacity,
        transform: [{translateX}, {translateY}, {scale}],
      }}
    />
  );
}

function Bubbles() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {BUBBLE_DATA.map((b, i) => (
        <Bubble key={i} data={b} />
      ))}
    </View>
  );
}

function WaveDecoration() {
  const w = SCREEN_W;
  const baseY = SCREEN_H - 120;
  return (
    <Svg
      style={[StyleSheet.absoluteFill]}
      width={w}
      height={SCREEN_H}
      pointerEvents="none">
      <Path
        d={`M0 ${baseY} Q${w * 0.25} ${baseY - 30} ${w * 0.5} ${baseY} T${w} ${baseY} L${w} ${SCREEN_H} L0 ${SCREEN_H} Z`}
        fill="#0C2D48"
        opacity={0.5}
      />
      <Path
        d={`M0 ${baseY + 25} Q${w * 0.3} ${baseY - 5} ${w * 0.55} ${baseY + 25} T${w} ${baseY + 25} L${w} ${SCREEN_H} L0 ${SCREEN_H} Z`}
        fill="#0A2540"
        opacity={0.4}
      />
    </Svg>
  );
}

function StartButtonSvg() {
  const size = 180;
  const center = size / 2;
  const radius = 72;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#38BDF8" stopOpacity={0.4} />
          <Stop offset="70%" stopColor="#0EA5E9" stopOpacity={0.1} />
          <Stop offset="100%" stopColor="#0EA5E9" stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="btnGrad" cx="40%" cy="35%" r="60%">
          <Stop offset="0%" stopColor="#38BDF8" />
          <Stop offset="100%" stopColor="#0284C7" />
        </RadialGradient>
      </Defs>
      <Circle cx={center} cy={center} r={center} fill="url(#glow)" />
      <Circle cx={center} cy={center} r={radius} fill="url(#btnGrad)" />
      <Circle
        cx={center}
        cy={center}
        r={radius - 2}
        fill="none"
        stroke="#7DD3FC"
        strokeWidth={1}
        opacity={0.3}
      />
    </Svg>
  );
}

export default function HomeScreen({onStart, onRecords, onExit}: Props) {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.06,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [fadeAnim, slideAnim, pulseAnim]);

  return (
    <View style={styles.container}>
      <Bubbles />
      <WaveDecoration />

      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{translateY: slideAnim}],
            paddingTop: insets.top + 60,
            paddingBottom: insets.bottom + 4,
          },
        ]}>
        {/* Title */}
        <View style={styles.titleArea}>
          <Text style={styles.titleSub}>BREATH HOLD TRAINING</Text>
          <Text style={styles.title}>ApneaTap</Text>
          <View style={styles.titleLine} />
        </View>

        {/* Start Button */}
        <View style={styles.centerArea}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={onStart}
            onPressIn={() => {
              Animated.spring(pressScale, {
                toValue: 0.9,
                friction: 5,
                tension: 100,
                useNativeDriver: true,
              }).start();
            }}
            onPressOut={() => {
              Animated.spring(pressScale, {
                toValue: 1,
                friction: 5,
                tension: 100,
                useNativeDriver: true,
              }).start();
            }}>
            <Animated.View
              style={[
                styles.startBtnWrap,
                {transform: [{scale: Animated.multiply(pulseAnim, pressScale)}]},
              ]}>
              <StartButtonSvg />
              <View style={styles.startTextWrap}>
                <Text style={styles.startText}>START</Text>
                <Text style={styles.startSubText}>TAP TO BEGIN</Text>
              </View>
            </Animated.View>
          </TouchableOpacity>
        </View>

        {/* Records Button */}
        <View style={styles.bottomArea}>
          <TouchableOpacity
            style={styles.recordButton}
            activeOpacity={0.7}
            onPress={onRecords}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <G opacity={0.9}>
                <Path
                  d="M3 3h18v2H3V3zm0 4h12v2H3V7zm0 4h18v2H3v-2zm0 4h12v2H3v-2zm0 4h18v2H3v-2z"
                  fill="#94A3B8"
                />
              </G>
            </Svg>
            <Text style={styles.recordText}>RECORDS</Text>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path
                d="M9 5l7 7-7 7"
                stroke="#64748B"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </TouchableOpacity>
        </View>
        <View style={styles.credits}>
          <Text style={styles.creditText}>created by RumBaugh Studio</Text>
          <Text style={styles.creditText}>designed by 먹보야놀자</Text>
        </View>
      </Animated.View>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="게임 나가기"
        hitSlop={8}
        activeOpacity={0.6}
        onPress={onExit}
        style={[styles.exit, {top: insets.top + 8, left: 16 + insets.left}]}>
        <Ionicons name="close" size={22} color="white" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  exit: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  container: {
    flex: 1,
    backgroundColor: '#0B1929',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleArea: {
    alignItems: 'center',
  },
  titleSub: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 4,
    marginBottom: 8,
  },
  title: {
    color: '#E2E8F0',
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: 1,
  },
  titleLine: {
    width: 40,
    height: 2,
    backgroundColor: '#0EA5E9',
    borderRadius: 1,
    marginTop: 16,
    opacity: 0.6,
  },
  centerArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  startBtnWrap: {
    width: 180,
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
  },
  startTextWrap: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  startText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 4,
  },
  startSubText: {
    color: '#BAE6FD',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 3,
    marginTop: 4,
    opacity: 0.7,
  },
  bottomArea: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 20,
  },
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.15)',
    gap: 10,
  },
  recordText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 2,
  },
  credits: {
    alignItems: 'center',
    gap: 3,
    marginBottom: 0,
  },
  creditText: {
    color: 'rgba(148, 163, 184, 0.25)',
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 1,
  },
});
