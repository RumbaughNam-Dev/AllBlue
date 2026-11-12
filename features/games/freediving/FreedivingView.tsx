import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BAL_DEAD, BAL_FEEL, balanceOf, clamp, closeness, DiveState, FIN_ZONE } from './sim';

// 프리다이빙 게임 한 장면 그리기 (바다 · 줄 · 다이버 · 위쪽 막대 · 아래 조작 버튼 모양).
// 게임 화면과 게임 고르기 팝업의 미리보기가 같이 씀. 터치는 받지 않음 (게임 화면이 따로 받음)

export const PPM = 44; // 1 m = 44 px
const CAM_Y = 0.46; // 카메라가 보는 곳(다이버)이 화면 위에서 이 비율 위치

export type Insets = { top: number; bottom: number; left: number; right: number };
export type Camera = { x: number; y: number };
export type StickView = { x: number; y: number } | null; // 조이스틱 손잡이 위치 (-1 ~ 1), 안 누르면 null

// 아래 조작 버튼 자리 (터치 판정도 같은 값을 씀)
export function controlsLayout(width: number, height: number, insets: Insets) {
  const r = Math.min(66, width * 0.17);
  const bottom = height - insets.bottom - 30;
  const padW = Math.min(92, width * 0.23);
  const padH = r * 2 + 20;
  return {
    stick: { cx: insets.left + 26 + r, cy: bottom - r, r },
    pad: { x: width - insets.right - 26 - padW, y: bottom - padH, w: padW, h: padH },
  };
}

// 수심에 따른 물빛: 수면 근처 밝은 파랑 → 깊을수록 남색 → 거의 검정
const WATER: [number, [number, number, number]][] = [
  [0, [44, 156, 210]], [8, [24, 112, 178]], [20, [13, 74, 132]], [40, [7, 44, 84]], [70, [3, 20, 42]], [120, [1, 8, 18]],
];
export function waterColor(depth: number) {
  const d = clamp(depth, 0, 120);
  for (let i = 1; i < WATER.length; i++) {
    const [d1, c1] = WATER[i];
    if (d <= d1) {
      const [d0, c0] = WATER[i - 1];
      const t = (d - d0) / (d1 - d0);
      return `rgb(${c0.map((v, k) => Math.round(v + (c1[k] - v) * t)).join(',')})`;
    }
  }
  return 'rgb(1,8,18)';
}

// 칸마다 같은 자리에 같은 부유물이 보이게 (움직임이 느껴지도록)
const hash = (i: number, j: number, k: number) => {
  const v = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453;
  return v - Math.floor(v);
};

type Pt = [number, number];
const along = (p: Pt, a: number, len: number): Pt => [p[0] + Math.cos(a) * len, p[1] + Math.sin(a) * len];

// 다이버 관절 위치 (m). 각도는 sim과 같음: 몸통 phi, 배 쪽으로 굽히면 +
export function diverPose(s: DiveState) {
  const f = s.facing;
  const floating = s.phase === 'surface';
  const depth = floating ? 0.12 + 0.04 * Math.sin(s.time * 1.7) : s.depth;
  const waist: Pt = [s.x, depth];
  const chestA = s.phi + f * s.neck * 0.35;
  const headA = s.phi + f * s.neck;
  const legsA = s.phi + Math.PI - f * s.hip + f * 0.14 * s.kickPower * Math.sin(s.kick);
  const finA = legsA + f * 0.5 * s.kickPower * Math.sin(s.kick - 1.1);
  const armA = chestA + Math.PI - f * s.arm;
  const hips = along(waist, s.phi, -0.3);
  const shoulders = along(waist, chestA, 0.36);
  const head = along(shoulders, headA, 0.17);
  const ankles = along(hips, legsA, 0.88);
  const finTip = along(ankles, finA, 0.55);
  const hands = along(shoulders, armA, 0.6);
  const mask = along(head, headA + f * Math.PI / 2, 0.09);
  return { waist, hips, shoulders, head, ankles, finTip, hands, mask, headA };
}

function Segment({ a, b, w, color, border }: { a: Pt; b: Pt; w: number; color: string; border?: string }) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
  return (
    <View style={{
      position: 'absolute', left: (a[0] + b[0]) / 2 - (len + w) / 2, top: (a[1] + b[1]) / 2 - w / 2,
      width: len + w, height: w, borderRadius: w / 2, backgroundColor: color,
      borderWidth: border ? 1 : 0, borderColor: border, transform: [{ rotate: `${angle}rad` }],
    }} />
  );
}

const SUIT = '#0E1C28';
const SUIT_EDGE = 'rgba(160,220,255,0.4)';

function Diver({ s, toPx }: { s: DiveState; toPx: (p: Pt) => Pt }) {
  const p = diverPose(s);
  const m = (v: number) => v * PPM;
  const head = toPx(p.head);
  const mask = toPx(p.mask);
  const r = m(0.14);
  return (
    <>
      <Segment a={toPx(p.ankles)} b={toPx(p.finTip)} w={m(0.19)} color="rgba(0,180,216,0.92)" border="rgba(255,255,255,0.35)" />
      <Segment a={toPx(p.hips)} b={toPx(p.ankles)} w={m(0.21)} color={SUIT} border={SUIT_EDGE} />
      <Segment a={toPx(p.hips)} b={toPx(p.waist)} w={m(0.32)} color={SUIT} border={SUIT_EDGE} />
      <Segment a={toPx(p.waist)} b={toPx(p.shoulders)} w={m(0.37)} color={SUIT} border={SUIT_EDGE} />
      <Segment a={toPx(p.shoulders)} b={toPx(p.hands)} w={m(0.13)} color="#15293B" border={SUIT_EDGE} />
      <View style={{ position: 'absolute', left: head[0] - r, top: head[1] - r, width: r * 2, height: r * 2, borderRadius: r, backgroundColor: SUIT, borderWidth: 1, borderColor: SUIT_EDGE }} />
      <View style={{
        position: 'absolute', left: mask[0] - m(0.06), top: mask[1] - m(0.035), width: m(0.12), height: m(0.07), borderRadius: m(0.02),
        backgroundColor: '#9FF3FF', transform: [{ rotate: `${p.headA}rad` }],
      }} />
    </>
  );
}

function Scene({ s, cam, width, height }: { s: DiveState; cam: Camera; width: number; height: number }) {
  const toX = (x: number) => width / 2 + (x - cam.x) * PPM;
  const toY = (y: number) => height * CAM_Y + (y - cam.y) * PPM;
  const toPx = (p: Pt): Pt => [toX(p[0]), toY(p[1])];
  const top = cam.y - (height * CAM_Y) / PPM;
  const bottom = top + height / PPM;
  const left = cam.x - width / 2 / PPM;
  const right = left + width / PPM;
  const surfaceY = toY(0);

  const bands: React.ReactNode[] = [];
  for (let d = Math.max(0, Math.floor(top)); d < Math.ceil(bottom); d++) {
    bands.push(<View key={`w${d}`} style={[styles.band, { top: toY(d), height: PPM + 1, backgroundColor: waterColor(d + 0.5) }]} />);
  }

  // 수면 근처 빛줄기 (깊어지면 사라짐)
  const rays: React.ReactNode[] = [];
  const rayAlpha = clamp(1 - cam.y / 22, 0, 1) * 0.07;
  if (rayAlpha > 0.005) {
    for (let k = Math.floor(left / 3) - 2; k <= Math.ceil(right / 3) + 2; k++) {
      const x = k * 3 + hash(k, 0, 1) * 2 + 0.6 * Math.sin(s.time * 0.3 + k);
      const w = 14 + hash(k, 0, 2) * 30;
      const h = 16 * PPM;
      rays.push(<View key={`r${k}`} style={{
        position: 'absolute', left: toX(x) - w / 2, top: surfaceY, width: w, height: h,
        backgroundImage: `linear-gradient(to bottom, rgba(255,255,255,${(rayAlpha * 1.6).toFixed(3)}), rgba(255,255,255,0))`,
        transform: [{ translateY: -h / 2 }, { rotate: `${0.18 + 0.05 * Math.sin(k)}rad` }, { translateY: h / 2 }],
      }} />);
    }
  }

  // 물속 부유물 (월드에 고정 → 다이버가 움직이면 지나감)
  const specks: React.ReactNode[] = [];
  const cell = 2.4;
  for (let i = Math.floor(left / cell); i <= Math.ceil(right / cell); i++) {
    for (let j = Math.max(0, Math.floor(top / cell)); j <= Math.ceil(bottom / cell); j++) {
      const x = (i + hash(i, j, 1)) * cell;
      const y = (j + hash(i, j, 2)) * cell;
      if (y < 0.4) continue;
      const size = 2 + hash(i, j, 3) * 2.5;
      specks.push(<View key={`p${i}_${j}`} style={{
        position: 'absolute', left: toX(x), top: toY(y), width: size, height: size, borderRadius: size / 2,
        backgroundColor: `rgba(220,240,255,${(0.18 + hash(i, j, 4) * 0.3).toFixed(2)})`,
      }} />);
    }
  }

  // 다이빙 줄 (x = 0)과 5 m마다 표시
  const ropeX = toX(0);
  const marks: React.ReactNode[] = [];
  for (let d = 5; d <= 120; d += 5) {
    if (d < top - 1 || d > bottom + 1) continue;
    marks.push(
      <View key={`m${d}`} style={[styles.mark, { left: ropeX - 6, top: toY(d) - 8 }]}>
        <View style={styles.tick} />
        <Text style={styles.markText}>{d}m</Text>
      </View>,
    );
  }

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: waterColor(cam.y) }]} pointerEvents="none">
      {bands}
      {surfaceY > 0 ? <View style={[styles.sky, { height: surfaceY }]} /> : null}
      {rays}
      {specks}
      {surfaceY < height ? <View style={[styles.rope, { left: ropeX - 1, top: Math.max(surfaceY, 0), height: height - Math.max(surfaceY, 0) }]} /> : null}
      {marks}
      <Diver s={s} toPx={toPx} />
      {surfaceY > -20 && surfaceY < height + 20 ? (
        <>
          <View style={[styles.surfaceGlow, { top: surfaceY }]} />
          <View style={[styles.surfaceLine, { top: surfaceY - 1 }]} />
          <View style={[styles.buoy, { left: ropeX - 12, top: surfaceY - 15 }]}><View style={styles.buoyStripe} /></View>
        </>
      ) : null}
    </View>
  );
}

const fmtTime = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

// 위쪽: 수심 · 폐 공기 · 압력평형 막대
function Hud({ s, width, insets }: { s: DiveState; width: number; insets: Insets }) {
  const barW = width - 32 - insets.left - insets.right;
  const bal = balanceOf(s);
  // 막대는 평형(왼쪽 끝)에서 시작해 통증 쪽으로만 감 (음압 없음)
  const pos = (b: number) => (clamp(b, 0, BAL_DEAD) / BAL_DEAD) * barW;
  const feel = pos(BAL_FEEL);
  const pain = bal > BAL_FEEL;
  const needleColor = pain ? (bal > BAL_FEEL + 0.25 ? '#FF3B30' : '#FF9F0A') : closeness(bal) > 0.7 ? '#00E5FF' : '#FFFFFF';
  const air = Math.round(s.air * 100);
  const airColor = s.air < 0.1 ? '#FF3B30' : s.air < 0.2 ? '#FF9F0A' : '#00E5FF';
  const painW = barW - feel;
  return (
    <View pointerEvents="none" style={[styles.hud, { top: insets.top + 6, left: 16 + insets.left, right: 16 + insets.right }]}>
      {/* 밝은 하늘 · 수면 위에서도 글씨가 보이게 어두운 판 */}
      <View style={styles.hudBack} />
      <View style={styles.hudTop}>
        <View style={{ width: 44 }} />
        {/* 10 m 아래에서 차지 않고 머리를 아래로 두면 프리폴 */}
        <View style={styles.ffSlot}>{s.freefall ? <View style={styles.ffPill}><Text style={styles.ffText}>프리폴</Text></View> : null}</View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.depth}>{s.phase === 'surface' ? '수면' : `${s.depth.toFixed(1)}m`}</Text>
          <Text style={styles.sub}>최대 {s.maxDepth.toFixed(1)}m · 이퀄 {s.eqCount}회 · 피닝 {s.finCount}회 · {fmtTime(s.diveTime)}</Text>
        </View>
      </View>

      <View style={styles.labelRow}>
        <Text style={styles.label}>폐 공기</Text>
        <Text style={[styles.label, { color: airColor }]}>{s.phase === 'dive' && s.air < 0.2 ? `${air}% · 블랙아웃 주의` : `${air}%`}</Text>
      </View>
      <View style={[styles.airBar, { width: barW }]}>
        <View style={{ width: barW * s.air, height: '100%', borderRadius: 4, backgroundColor: airColor }} />
      </View>

      <View style={[styles.labelRow, { marginTop: 10 }]}>
        <Text style={styles.label}>압력 평형</Text>
        {pain ? <Text style={[styles.label, { color: needleColor }]}>귀가 아파요</Text> : null}
      </View>
      <View style={{ width: barW, height: 22, justifyContent: 'center' }}>
        <View style={[styles.balBar, { width: barW }]}>
          <View style={{ width: feel, backgroundColor: 'rgba(0,229,255,0.32)' }} />
          <View style={{ width: painW, backgroundImage: 'linear-gradient(to right, rgba(255,170,60,0.55), rgba(255,40,40,0.9))' }} />
        </View>
        {/* 첫 번째 선 = 평형 (막대가 시작하는 곳), 두 번째 선 = 느낌 */}
        <View style={[styles.markLine, { left: 0 }]} />
        <View style={[styles.markLine, { left: feel - 1 }]} />
        <View style={[styles.needle, { left: pos(bal) - 3, backgroundColor: needleColor }]} />
      </View>
      <View style={{ width: barW, height: 14 }}>
        <Text style={[styles.caption, { left: 0, width: 40, textAlign: 'left' }]}>평형</Text>
        <Text style={[styles.caption, { left: feel - 20, width: 40, textAlign: 'center', color: '#00E5FF' }]}>느낌</Text>
        <Text style={[styles.caption, { left: feel + 20, width: painW - 20, textAlign: 'center' }]}>통증</Text>
      </View>
    </View>
  );
}

// 아래: 왼쪽 방향 조이스틱, 오른쪽 이퀄 버튼 (모양만, 터치는 게임 화면이 받음)
function Controls({ s, width, height, insets, stick }: { s: DiveState; width: number; height: number; insets: Insets; stick: StickView }) {
  const { stick: st, pad } = controlsLayout(width, height, insets);
  // 손잡이 가운데가 손가락 자리 (끝까지 밀면 원 가장자리)
  const knobR = st.r * 0.3;
  const kx = st.cx + (stick?.x ?? 0) * st.r;
  const ky = st.cy + (stick?.y ?? 0) * st.r;
  const fill = s.eqHeld ? s.eqStrength : 0;
  // 안쪽 원까지는 방향만, 손잡이가 원 밖으로 나가면 피닝 (sim FIN_ZONE)
  const ring = FIN_ZONE * st.r;
  const m = stick ? Math.hypot(stick.x, stick.y) : 0;
  const finning = s.phase === 'dive' && !!stick && m >= FIN_ZONE;
  const stickLabel = s.phase !== 'dive' ? '방향' : finning ? '피닝' : stick && m > 0.18 ? '방향만' : s.freefall ? '프리폴' : '방향 · 피닝';
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.stickBase, { left: st.cx - st.r, top: st.cy - st.r, width: st.r * 2, height: st.r * 2, borderRadius: st.r }, finning && { borderColor: 'rgba(0,229,255,0.75)' }]} />
      <View style={[styles.stickRing, { left: st.cx - ring, top: st.cy - ring, width: ring * 2, height: ring * 2, borderRadius: ring }]} />
      <View style={[styles.knob, {
        left: kx - knobR, top: ky - knobR, width: knobR * 2, height: knobR * 2, borderRadius: knobR,
        backgroundColor: stick ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.55)',
      }]} />
      <Text style={[styles.controlLabel, { left: st.cx - 40, top: st.cy + st.r + 4 }, finning && { color: '#00E5FF' }]}>{stickLabel}</Text>

      {/* 수면에서는 숨을 쉬는 중이라 이퀄할 게 없음 (흐리게) */}
      <View style={[styles.pad, { left: pad.x, top: pad.y, width: pad.w, height: pad.h, opacity: s.phase === 'surface' ? 0.6 : 1 }]}>
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: pad.h * fill, backgroundColor: s.eqActive ? 'rgba(0,229,255,0.5)' : 'rgba(255,255,255,0.2)' }} />
        <Text style={styles.padHint}>세게</Text>
        <Text style={styles.padText}>이퀄</Text>
        <Text style={styles.padHint}>약하게</Text>
      </View>
      <Text style={[styles.controlLabel, { left: pad.x + pad.w / 2 - 40, top: pad.y + pad.h + 4 }]}>{s.eqHeld ? `세기 ${Math.round(s.eqStrength * 100)}%` : '누르고 있기'}</Text>
    </View>
  );
}

export default function FreedivingView({ state, cam, width, height, insets, stick }: {
  state: DiveState; cam: Camera; width: number; height: number; insets: Insets; stick: StickView;
}) {
  const bal = balanceOf(state);
  const pain = state.phase === 'dive' && bal > BAL_FEEL ? clamp((bal - BAL_FEEL) / (BAL_DEAD - BAL_FEEL), 0, 1) : 0;
  // 폐 공기가 25%보다 적으면 눈앞이 점점 어두워짐 (블랙아웃이 가까움)
  const dark = state.phase === 'dive' ? clamp((0.25 - state.air) / 0.25, 0, 1) : 0;
  return (
    <View style={{ width, height, overflow: 'hidden' }}>
      <Scene s={state} cam={cam} width={width} height={height} />
      {dark > 0 ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, {
          boxShadow: `inset 0 0 ${Math.round(60 + 100 * dark)}px ${Math.round(10 + 70 * dark)}px rgba(0,0,0,${(0.3 + 0.55 * dark).toFixed(3)})`,
        }]} />
      ) : null}
      {/* 귀가 아플수록 화면 가장자리가 붉게, 끝에 가까울수록 빨리 맥박침 */}
      {pain > 0 ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, {
          boxShadow: `inset 0 0 ${Math.round(50 + 70 * pain)}px ${Math.round(8 + 40 * pain)}px rgba(210,0,0,${((0.35 + 0.5 * pain) * (0.8 + 0.2 * Math.sin(state.time * (6 + 10 * pain)))).toFixed(3)})`,
        }]} />
      ) : null}
      <Hud s={state} width={width} insets={insets} />
      <Controls s={state} width={width} height={height} insets={insets} stick={stick} />
    </View>
  );
}

const styles = StyleSheet.create({
  band: { position: 'absolute', left: 0, right: 0 },
  sky: { position: 'absolute', left: 0, right: 0, top: 0, backgroundColor: '#A4DCF4', backgroundImage: 'linear-gradient(to bottom, #6FC2EC, #CBEFFC)' },
  surfaceLine: { position: 'absolute', left: 0, right: 0, height: 3, backgroundColor: 'rgba(255,255,255,0.8)' },
  surfaceGlow: { position: 'absolute', left: 0, right: 0, height: 14, backgroundColor: 'rgba(255,255,255,0.12)' },
  buoy: { position: 'absolute', width: 24, height: 24, borderRadius: 12, backgroundColor: '#FF7A1A', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  buoyStripe: { width: 24, height: 5, backgroundColor: 'rgba(255,255,255,0.85)' },
  rope: { position: 'absolute', width: 2, backgroundColor: 'rgba(255,236,200,0.5)' },
  mark: { position: 'absolute', width: 60, height: 16, flexDirection: 'row', alignItems: 'center', gap: 4 },
  tick: { width: 12, height: 4, borderRadius: 2, backgroundColor: '#FFB703' },
  markText: { fontFamily: 'SUIT-SemiBold', fontSize: 11, color: 'rgba(255,255,255,0.75)' },
  hud: { position: 'absolute' },
  hudBack: { position: 'absolute', left: -10, right: -10, top: 52, bottom: -6, borderRadius: 14, backgroundColor: 'rgba(2,24,48,0.35)' },
  hudTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  depth: { fontFamily: 'SUIT-Bold', fontSize: 30, color: '#FFFFFF', textShadowColor: 'rgba(0,30,60,0.55)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  sub: { fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2, textShadowColor: 'rgba(0,30,60,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  label: { fontFamily: 'SUIT-SemiBold', fontSize: 12, color: 'rgba(255,255,255,0.85)' },
  airBar: { height: 8, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.3)', overflow: 'hidden' },
  balBar: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.3)' },
  markLine: { position: 'absolute', top: 0, width: 2, height: 22, backgroundColor: '#FFFFFF' },
  needle: { position: 'absolute', top: -2, width: 6, height: 26, borderRadius: 3, borderWidth: 1, borderColor: 'rgba(0,0,0,0.5)' },
  caption: { position: 'absolute', top: 1, fontFamily: 'SUIT-Regular', fontSize: 10, color: 'rgba(255,255,255,0.6)' },
  stickBase: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)' },
  stickRing: { position: 'absolute', borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.3)' },
  ffSlot: { flex: 1, alignItems: 'flex-end', paddingRight: 10, paddingTop: 10 },
  ffPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(0,229,255,0.25)', borderWidth: 1, borderColor: 'rgba(0,229,255,0.7)' },
  ffText: { fontFamily: 'SUIT-Bold', fontSize: 12, color: '#FFFFFF' },
  knob: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(0,0,0,0.25)' },
  controlLabel: { position: 'absolute', width: 80, textAlign: 'center', fontFamily: 'SUIT-SemiBold', fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  pad: {
    position: 'absolute', borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)',
  },
  padHint: { fontFamily: 'SUIT-Regular', fontSize: 10, color: 'rgba(255,255,255,0.6)' },
  padText: { fontFamily: 'SUIT-Bold', fontSize: 16, color: '#FFFFFF', textAlign: 'center' },
});
