import React, { useEffect, useRef, useState } from 'react';
import { Animated, GestureResponderEvent, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { ViewInstance } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/services/api';
import FreedivingView, { Camera, controlsLayout, StickView } from './FreedivingView';
import { BAL_DEAD, BAL_FEEL, balanceOf, clamp, createGame, DiveState, GameInput, recordOf, scoreOf, stepGame, TARGET_DEPTH } from './sim';

// 프리다이빙 게임 화면: 화면 갱신 · 두 손가락 터치(왼쪽 방향 · 오른쪽 이퀄) · 시작 안내 · WASTED · 점수 · 기록 저장
type Ended = 'wasted' | 'done' | null;
type TouchKind = 'stick' | 'eq';
// 판이 끝나면 서버에 저장 (내 기록 화면에서 시각 · 점수 · 세부 점수를 봄)
type Saved = { status: 'saving' } | { status: 'saved'; best: number; isBest: boolean; count: number } | { status: 'error' } | null;
const GAME = 'freediving';

export default function FreedivingGame() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const sim = useRef<DiveState>(createGame());
  const cam = useRef<Camera>({ x: sim.current.x, y: 0 });
  const input = useRef<GameInput>({ jx: 0, jy: 0, eq: false, strength: 0.5 });
  const [stick, setStick] = useState<StickView>(null);
  const [, setFrame] = useState(0);
  const [started, setStarted] = useState(false);
  const [ended, setEnded] = useState<Ended>(null);
  const [showResult, setShowResult] = useState(false);
  const [saved, setSaved] = useState<Saved>(null);
  const play = useRef(0); // 다시 하기마다 늘어남 — 저장 응답이 늦게 와도 지난 판 결과를 새 판에 붙이지 않게
  const wasted = useRef(new Animated.Value(0)).current;
  const openRecords = () => router.push({ pathname: '/game-records', params: { game: GAME } });

  // 터치: 화면 하나가 모든 손가락을 받고, 처음 닿은 쪽(왼쪽 아래 · 오른쪽 아래)으로 나눔
  // 그리기와 터치 판정 모두 실제 화면 크기(onLayout)를 씀 — 안드로이드는 창 크기와 다를 수 있음
  const root = useRef<ViewInstance | null>(null);
  const [box, setBox] = useState({ w: width, h: height });
  const size = useRef({ x: 0, y: 0, w: width, h: height });
  const touches = useRef(new Map<string, TouchKind>());
  const layout = controlsLayout(box.w, box.h, insets);

  const applyTouch = (kind: TouchKind, px: number, py: number) => {
    const x = px - size.current.x;
    const y = py - size.current.y;
    if (kind === 'stick') {
      const { cx, cy, r } = layout.stick;
      const dx = (x - cx) / r;
      const dy = (y - cy) / r;
      const len = Math.hypot(dx, dy);
      const k = len > 1 ? 1 / len : 1;
      input.current.jx = dx * k;
      input.current.jy = dy * k;
      setStick({ x: dx * k, y: dy * k });
    } else {
      const { y: top, h } = layout.pad;
      input.current.eq = true;
      input.current.strength = clamp((top + h - y) / h, 0, 1);
    }
  };
  const release = (kind: TouchKind) => {
    if (kind === 'stick') { input.current.jx = 0; input.current.jy = 0; setStick(null); }
    else input.current.eq = false;
  };
  const releaseAll = () => {
    touches.current.forEach(release);
    touches.current.clear();
  };
  const onStart = (e: GestureResponderEvent) => {
    for (const t of e.nativeEvent.changedTouches) {
      const id = String(t.identifier);
      if (touches.current.has(id)) continue;
      const x = t.pageX - size.current.x;
      const y = t.pageY - size.current.y;
      if (y < size.current.h * 0.38) continue; // 위쪽(막대 자리)은 조작 아님
      const kind: TouchKind = x < size.current.w / 2 ? 'stick' : 'eq';
      if ([...touches.current.values()].includes(kind)) continue;
      touches.current.set(id, kind);
      if (kind === 'eq' && sim.current.air > 0) void Haptics.selectionAsync();
      applyTouch(kind, t.pageX, t.pageY);
    }
  };
  const onMove = (e: GestureResponderEvent) => {
    for (const t of e.nativeEvent.touches) {
      const kind = touches.current.get(String(t.identifier));
      if (kind) applyTouch(kind, t.pageX, t.pageY);
    }
  };
  const onEnd = (e: GestureResponderEvent) => {
    for (const t of e.nativeEvent.changedTouches) {
      const id = String(t.identifier);
      const kind = touches.current.get(id);
      if (!kind) continue;
      touches.current.delete(id);
      release(kind);
    }
  };

  const reset = () => {
    releaseAll();
    play.current += 1;
    sim.current = createGame();
    cam.current = { x: sim.current.x, y: 0 };
    wasted.setValue(0);
    setShowResult(false);
    setSaved(null);
    setEnded(null);
    setFrame(f => f + 1);
  };

  // 게임 진행 (매 화면마다 물리 한 걸음 → 카메라 → 진동 → 다시 그리기)
  useEffect(() => {
    if (!started || ended) return;
    let raf = 0;
    let last: number | null = null;
    let buzzAt = 0;
    const loop = (now: number) => {
      const dt = last === null ? 0 : Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = sim.current;
      stepGame(s, input.current, dt);
      const c = cam.current;
      const k = Math.min(1, 3.5 * dt);
      c.x += (s.x - c.x) * k;
      c.y += (s.depth - c.y) * k;
      // 두 번째 선을 넘으면 통증: 끝에 가까울수록 자주 떨림
      const bal = balanceOf(s);
      if (s.phase === 'dive' && bal > BAL_FEEL) {
        const pain = clamp((bal - BAL_FEEL) / (BAL_DEAD - BAL_FEEL), 0, 1);
        if (s.time - buzzAt > 0.55 - 0.42 * pain) {
          buzzAt = s.time;
          void Haptics.impactAsync(pain > 0.6 ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light);
        }
      }
      setFrame(f => f + 1);
      if (s.phase === 'wasted' || s.phase === 'done') {
        releaseAll();
        setEnded(s.phase);
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [started, ended]); // eslint-disable-line react-hooks/exhaustive-deps

  // 한 판 기록 저장 (WASTED 0점도 남김). 실패하면 점수 창에서 다시 저장
  const save = async () => {
    const id = play.current;
    setSaved({ status: 'saving' });
    try {
      const res = await api.saveGameRecord(GAME, recordOf(sim.current));
      if (id === play.current) setSaved({ status: 'saved', best: res.best, isBest: res.isBest, count: res.count });
    } catch {
      if (id === play.current) setSaved({ status: 'error' });
    }
  };

  // 끝났을 때: 기록 저장, WASTED 연출 뒤 점수, 수면에 올라오면 바로 점수
  useEffect(() => {
    if (ended) void save();
    if (ended === 'wasted') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Animated.timing(wasted, { toValue: 1, duration: 900, useNativeDriver: true }).start();
      const timer = setTimeout(() => setShowResult(true), 1600);
      return () => clearTimeout(timer);
    }
    if (ended === 'done') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowResult(true);
    }
  }, [ended, wasted]); // eslint-disable-line react-hooks/exhaustive-deps

  const s = sim.current;
  const playing = started && !ended;
  const shallow = s.phase === 'surface' && s.shallowAt !== null && s.time - s.shallowAt < 3;

  return (
    <View
      ref={root}
      style={styles.root}
      onLayout={e => {
        const { width: w, height: h } = e.nativeEvent.layout;
        setBox({ w, h });
        size.current = { ...size.current, w, h };
        root.current?.measureInWindow((x, y) => { size.current = { ...size.current, x, y }; });
      }}
    >
      <StatusBar hidden />
      <FreedivingView state={s} cam={cam.current} width={box.w} height={box.h} insets={insets} stick={stick} />

      {/* 손가락 여러 개를 한 곳에서 받음 (위의 버튼 · 안내 창은 그 위에 있어서 따로 눌림) */}
      <View
        style={StyleSheet.absoluteFill}
        onStartShouldSetResponder={() => playing}
        onMoveShouldSetResponder={() => playing}
        onResponderTerminationRequest={() => false}
        onResponderGrant={onStart}
        onResponderStart={onStart}
        onResponderMove={onMove}
        onResponderEnd={onEnd}
        onResponderRelease={releaseAll}
        onResponderTerminate={releaseAll}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="게임 나가기"
        hitSlop={8}
        onPress={() => router.back()}
        style={({ pressed }) => [styles.close, { top: insets.top + 8, left: 16 + insets.left }, pressed && { opacity: 0.6 }]}
      >
        <Ionicons name="close" size={22} color="white" />
      </Pressable>

      {shallow ? (
        <View pointerEvents="none" style={[styles.toast, { top: box.h * 0.3 }]}>
          <Text style={styles.toastText}>너무 얕았어요. 다시 덕다이브해 보세요</Text>
        </View>
      ) : null}

      {!started ? <Intro onStart={() => setStarted(true)} onRecords={openRecords} onExit={() => router.back()} /> : null}

      {ended === 'wasted' ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.wastedDim, { opacity: wasted, paddingTop: box.h * 0.22 }]}>
          <Animated.Text style={[styles.wastedText, { transform: [{ scale: wasted.interpolate({ inputRange: [0, 1], outputRange: [1.6, 1] }) }] }]}>
            WASTED
          </Animated.Text>
        </Animated.View>
      ) : null}

      {showResult ? (
        <Result state={s} saved={saved} bottom={insets.bottom} onRetry={reset} onSave={() => void save()} onRecords={openRecords} onExit={() => router.back()} />
      ) : null}
    </View>
  );
}

function Intro({ onStart, onRecords, onExit }: { onStart: () => void; onRecords: () => void; onExit: () => void }) {
  // 작은 화면에서 안내가 넘치면 스크롤
  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay, { paddingHorizontal: 0 }]}>
      <ScrollView contentContainerStyle={styles.introScroll} showsVerticalScrollIndicator={false}>
      <View style={styles.card}>
        <Text style={styles.title}>프리다이빙</Text>
        <Text style={styles.lead}>압력평형과 릴렉스가 전부예요.{'\n'}수면 아래로 들어가면 시작, 다시 올라오면 끝이에요.</Text>
        <View style={styles.steps}>
          <Step n={1} text="오른쪽 이퀄 버튼을 누르고 있으면 귀 압력이 올라가요. 수면에서 미리 누르면 프리 이퀄 (바늘이 왼쪽으로)" />
          <Step n={2} text="왼쪽 조이스틱으로 옆으로 헤엄치다가 아래로 당기면 덕다이브. 물속에서는 조이스틱 방향이 머리 방향이에요. 점선 원 안은 방향만 바꾸고, 원 밖으로 밀면 피닝 (멀리 밀수록 세게)" />
          <Step n={3} text="내려가면 바늘이 오른쪽으로 가요. 두 번째 선(느낌) 근처를 지키세요. 오른쪽 끝까지 가면 고막이 버티지 못해요" />
          <Step n={4} text="이퀄은 누를 때마다, 세게 할수록 폐 공기를 많이 써요. 피닝도 5번에 1%씩 써요. 공기가 없으면 이퀄이 안 돼요. 아껴 쓰면서 남김없이 다 쓰고 깊이 갈수록 점수가 높아요" />
          <Step n={5} text="10m 위에서는 가만있어도 떠오르고, 10m 아래에서는 가라앉아요. 10m 아래에서 머리를 아래로 두고 손을 떼면 프리폴 (공기를 안 써요). 올라올 땐 위로 원 밖까지 밀어 피닝" />
        </View>
        <Pressable accessibilityRole="button" onPress={onStart} style={({ pressed }) => [styles.primary, pressed && { opacity: 0.7 }]}>
          <Text style={styles.primaryText}>시작</Text>
        </Pressable>
        <SubButtons onRecords={onRecords} onExit={onExit} />
      </View>
      </ScrollView>
    </View>
  );
}

// 아래 줄: 내 기록 · 나가기
function SubButtons({ onRecords, onExit }: { onRecords: () => void; onExit: () => void }) {
  return (
    <View style={styles.subRow}>
      <Pressable accessibilityRole="button" onPress={onRecords} style={({ pressed }) => [styles.secondary, styles.subButton, pressed && { opacity: 0.6 }]}>
        <Text style={styles.secondaryText}>내 기록</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onExit} style={({ pressed }) => [styles.secondary, styles.subButton, pressed && { opacity: 0.6 }]}>
        <Text style={styles.secondaryText}>나가기</Text>
      </Pressable>
    </View>
  );
}

// 저장 결과 한 줄: 새 최고 기록 · 내 최고 점수 · 실패하면 다시 저장
function SavedLine({ saved, onSave }: { saved: Saved; onSave: () => void }) {
  if (!saved || saved.status === 'saving') return <Text style={styles.savedText}>기록 저장 중…</Text>;
  if (saved.status === 'error') {
    return (
      <Pressable accessibilityRole="button" onPress={onSave} hitSlop={8}>
        <Text style={[styles.savedText, { color: '#FFB4AC' }]}>기록을 저장하지 못했어요 · <Text style={styles.savedLink}>다시 저장</Text></Text>
      </Pressable>
    );
  }
  if (saved.count === 1) return <Text style={styles.savedText}>첫 기록이 저장됐어요</Text>;
  if (saved.isBest) return <Text style={[styles.savedText, styles.savedBest]}>새 최고 기록이에요! · {saved.count}번째 판</Text>;
  return <Text style={styles.savedText}>내 최고 {saved.best}점 · {saved.count}번째 판</Text>;
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNum}><Text style={styles.stepNumText}>{n}</Text></View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

function Result({ state, saved, bottom, onRetry, onSave, onRecords, onExit }: {
  state: DiveState; saved: Saved; bottom: number; onRetry: () => void; onSave: () => void; onRecords: () => void; onExit: () => void;
}) {
  const sc = scoreOf(state);
  const dead = state.phase === 'wasted';
  const rows: [string, string, number, number][] = [
    ['최대 수심', `${state.maxDepth.toFixed(1)}m`, sc.depthPts, 40],
    ['폐 공기 사용', `${Math.round((1 - state.air) * 100)}%`, sc.airPts, 20],
    ['이퀄 횟수', `${state.eqCount}회 (알맞게 ${sc.idealEq}회)`, sc.eqPts, 15],
    ['두 번째 선 유지', `${Math.round(sc.zoneRate * 100)}%`, sc.zonePts, 25],
  ];
  // WASTED는 글자가 위에 남아 있게 결과 창을 아래쪽에 (이미 화면이 어두워져 있어 덮개 없이)
  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay, dead && { justifyContent: 'flex-end', paddingBottom: bottom + 24, backgroundColor: 'transparent' }]}>
      <View style={styles.card}>
        <Text style={styles.resultLabel}>{dead ? '고막이 버티지 못했어요' : '수면으로 돌아왔어요'}</Text>
        <Text style={[styles.score, dead && { color: '#FF5A4E' }]}>{sc.total}<Text style={styles.scoreUnit}>점</Text></Text>
        <SavedLine saved={saved} onSave={onSave} />
        {dead ? (
          <Text style={styles.lead}>압력 바늘이 오른쪽 끝까지 갔어요.{'\n'}두 번째 선을 넘기 전에 이퀄해 주세요.</Text>
        ) : (
          <View style={styles.rows}>
            {rows.map(([label, value, pts, max]) => (
              <View key={label} style={styles.row}>
                <Text style={styles.rowLabel}>{label}</Text>
                <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
                <Text style={styles.rowPts}>{Math.round(pts)}<Text style={styles.rowMax}>/{max}</Text></Text>
              </View>
            ))}
            {state.maxDepth < 20 ? <Text style={styles.note}>20m보다 얕으면 수심 말고 다른 점수는 깊이만큼만 쳐요. 만점 수심은 {TARGET_DEPTH}m예요.</Text> : null}
          </View>
        )}
        <Pressable accessibilityRole="button" onPress={onRetry} style={({ pressed }) => [styles.primary, pressed && { opacity: 0.7 }]}>
          <Text style={styles.primaryText}>다시 하기</Text>
        </Pressable>
        <SubButtons onRecords={onRecords} onExit={onExit} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#062A4D' },
  close: {
    position: 'absolute', width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  toast: { position: 'absolute', alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.55)' },
  toastText: { fontFamily: 'SUIT-SemiBold', fontSize: 14, color: '#FFFFFF' },
  overlay: { backgroundColor: 'rgba(2,14,28,0.55)', justifyContent: 'center', paddingHorizontal: 20 },
  card: { alignSelf: 'center', width: '100%', maxWidth: 400, borderRadius: 20, padding: 22, backgroundColor: 'rgba(2,62,115,0.96)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  title: { fontFamily: 'SUIT-Bold', fontSize: 24, color: '#FFFFFF', textAlign: 'center' },
  lead: { fontFamily: 'SUIT-Regular', fontSize: 14, lineHeight: 21, color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginTop: 8 },
  steps: { gap: 10, marginTop: 16 },
  step: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stepNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#00B4D8', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNumText: { fontFamily: 'SUIT-Bold', fontSize: 12, color: '#FFFFFF' },
  stepText: { flex: 1, fontFamily: 'SUIT-Regular', fontSize: 13, lineHeight: 20, color: '#FFFFFF' },
  primary: { height: 50, marginTop: 20, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#00B4D8' },
  primaryText: { fontFamily: 'SUIT-Bold', fontSize: 16, color: '#FFFFFF' },
  secondary: { height: 46, marginTop: 8, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  secondaryText: { fontFamily: 'SUIT-SemiBold', fontSize: 15, color: '#FFFFFF' },
  subRow: { flexDirection: 'row', gap: 8 },
  introScroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 24 },
  subButton: { flex: 1 },
  savedText: { fontFamily: 'SUIT-SemiBold', fontSize: 13, color: 'rgba(255,255,255,0.75)', textAlign: 'center', marginTop: 2 },
  savedBest: { color: '#00E5FF' },
  savedLink: { textDecorationLine: 'underline', color: '#FFFFFF' },
  wastedDim: { backgroundColor: 'rgba(40,40,40,0.6)', alignItems: 'center' },
  wastedText: {
    fontFamily: 'SUIT-Bold', fontSize: 64, letterSpacing: 4, color: '#E0263B',
    textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 6,
  },
  resultLabel: { fontFamily: 'SUIT-SemiBold', fontSize: 15, color: 'rgba(255,255,255,0.8)', textAlign: 'center' },
  score: { fontFamily: 'SUIT-Bold', fontSize: 56, color: '#00E5FF', textAlign: 'center', marginTop: 4 },
  scoreUnit: { fontSize: 22, color: 'rgba(255,255,255,0.8)' },
  rows: { marginTop: 12, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)' },
  rowLabel: { width: 96, fontFamily: 'SUIT-SemiBold', fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  rowValue: { flex: 1, fontFamily: 'SUIT-Regular', fontSize: 13, color: '#FFFFFF' },
  rowPts: { fontFamily: 'SUIT-Bold', fontSize: 15, color: '#FFFFFF' },
  rowMax: { fontFamily: 'SUIT-Regular', fontSize: 11, color: 'rgba(255,255,255,0.55)' },
  note: { fontFamily: 'SUIT-Regular', fontSize: 12, lineHeight: 18, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
});
