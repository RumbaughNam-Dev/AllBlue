// 프리다이빙 게임: 물리 · 압력평형 · 점수 계산 (화면 없이 계산만).
// 단위: m, 초, 기압(atm), 각도는 라디안. 화면 좌표와 같게 x는 오른쪽, 수심(y)은 아래가 +.
// 각도 0 = 오른쪽, +π/2 = 아래(깊은 쪽).
//
// 압력평형(balance) = 주변 수압 − 귀(중이) 압력.
//   BAL_MIN ~ 0     : 음압 (프리 이퀄로 귀 압력이 더 높음) — 막대의 첫 번째 선 왼쪽
//   0 ~ BAL_FEEL    : 내려가면서 수압이 오르면 이쪽으로 — 첫 번째와 두 번째 선 사이
//   BAL_FEEL ~ DEAD : 귀에 통증 — 두 번째 선 오른쪽, 끝까지 가면 WASTED
// 내려갈 때 두 번째 선(살짝 느낌이 오는 때) 근처를 지키는 게 핵심.

export const BAL_MIN = -0.3;
export const BAL_FEEL = 0.3;
export const BAL_DEAD = 0.75;
export const MAX_DEPTH = 120;
export const TARGET_DEPTH = 40; // 수심 점수 만점 (공기를 아껴 써야 닿는 깊이)

// 이퀄라이징: 누르고 있는 동안 귀 압력이 오름 (세기 1이면 초당 0.7기압)
const EQ_RATE = 0.7;
// 공기: 한 번 누를 때마다 + 누르고 있는 동안 (세게 할수록 제곱으로 더 듦), 깊을수록 폐가 줄어 더 듦
const PRESS_COST = 0.012;
const HOLD_BASE = 0.015;
const HOLD_STRENGTH = 0.08;
// 귀 압력이 주변보다 높으면(음압) 이관으로 조금씩 빠짐 (올라올 때 · 너무 세게 했을 때)
const VENT = 0.5;
// 10 m가 중성 부력: 위는 양성(가만있어도 떠오름), 아래는 음성(가라앉아서 피닝해야 올라옴)
export const NEUTRAL_DEPTH = 10;
const NEUTRAL_LUNG = 1 / (1 + NEUTRAL_DEPTH / 10);
const BUOYANCY = 1.4;
// 왼쪽 조이스틱: 안쪽 원(반지름의 FIN_ZONE)까지는 방향만 바꾸고 차지 않음(프리폴 · 글라이드), 그 바깥은 피닝 (멀리 밀수록 세게)
export const FIN_ZONE = 0.5;
// 피닝 5번에 폐 공기 1% (한 번 = 다리를 한 번 차고 돌아오는 왕복)
const FIN_COST = 0.002;
// 머리가 위를 향할수록 피닝이 더 잘 먹음 (올라오는 속도를 내려갈 때보다 빠르게)
const ASCENT_BOOST = 1.15;
const SURFACE_SPEED = 1.1;
const NECK_MAX = 1.0;

export type Phase = 'surface' | 'dive' | 'wasted' | 'done';

// jx · jy: 왼쪽 조이스틱 (-1 ~ 1, y는 아래가 +). eq: 오른쪽 이퀄 버튼을 누르고 있음, strength: 누른 위치의 세기 (0 ~ 1)
export type GameInput = { jx: number; jy: number; eq: boolean; strength: number };

export type DiveState = {
  phase: Phase;
  time: number;
  diveTime: number;
  seed: number;
  x: number;
  depth: number;
  vx: number;
  vy: number;
  // 몸통 방향(엉덩이 → 어깨)과 회전 속도
  phi: number;
  omega: number;
  // 관절 (배 쪽으로 굽히면 +): 목 · 엉덩이 · 팔
  neck: number;
  hip: number;
  arm: number;
  kick: number;
  kickPower: number;
  // 피닝 횟수 (물속에서 실제로 찬 왕복 수) · 다음 한 번까지 쌓인 다리 움직임
  finCount: number;
  finPhase: number;
  // 10 m 아래에서 안 차고 머리를 아래로 둔 채 내려가는 중 (위쪽 표시용)
  freefall: boolean;
  // 배가 어느 쪽인지 (1: 머리가 오른쪽일 때 배가 아래). 수면에서 가는 방향으로 정해지고 물속에선 그대로
  facing: 1 | -1;
  earP: number;
  air: number;
  eqCount: number;
  eqHeld: boolean;
  eqActive: boolean;
  eqStrength: number;
  maxDepth: number;
  // 내려가는 동안 두 번째 선 근처를 지킨 정도 (시간 가중 합)
  zoneSum: number;
  zoneTime: number;
  // 너무 얕게 들어갔다 나온 때 (안내 문구용)
  shallowAt: number | null;
};

const TWO_PI = Math.PI * 2;
export const wrap = (a: number) => ((((a + Math.PI) % TWO_PI) + TWO_PI) % TWO_PI) - Math.PI;
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const approach = (v: number, target: number, rate: number, dt: number) => v + (target - v) * Math.min(1, rate * dt);

export const ambientAt = (depth: number) => 1 + Math.max(0, depth) / 10;
export const lungAt = (depth: number) => 1 / (1 + Math.max(0, depth) / 10);
export const balanceOf = (s: Pick<DiveState, 'depth' | 'earP'>) => ambientAt(s.depth) - s.earP;

// 물살: 몇 개의 느린 파도를 겹친 흔들림 (판마다 seed로 다르게)
const current = (t: number) => 0.6 * Math.sin(1.13 * t) + 0.35 * Math.sin(2.71 * t + 1.3) + 0.25 * Math.sin(4.37 * t + 0.5);

export function createGame(seed = Math.random() * 100): DiveState {
  return {
    phase: 'surface', time: 0, diveTime: 0, seed,
    x: -3, depth: 0, vx: 0, vy: 0,
    phi: 0, omega: 0, neck: 0, hip: 0, arm: 0.1, kick: 0, kickPower: 0, finCount: 0, finPhase: 0, freefall: false, facing: 1,
    earP: 1, air: 1, eqCount: 0, eqHeld: false, eqActive: false, eqStrength: 0.5,
    maxDepth: 0, zoneSum: 0, zoneTime: 0, shallowAt: null,
  };
}

// 두 번째 선에 얼마나 가까운가 (1 = 딱 맞음). 왼쪽(덜 눌린 쪽)은 완만하게, 통증 쪽은 가파르게 깎임
export function closeness(balance: number) {
  return balance <= BAL_FEEL
    ? Math.max(0, 1 - (BAL_FEEL - balance) / 0.4)
    : Math.max(0, 1 - (balance - BAL_FEEL) / 0.2);
}

export function stepGame(s: DiveState, input: GameInput, dt: number) {
  const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    if (s.phase !== 'surface' && s.phase !== 'dive') return;
    tick(s, input, h);
  }
}

function tick(s: DiveState, input: GameInput, dt: number) {
  s.time += dt;
  equalize(s, input, dt);
  if (s.phase === 'surface') surface(s, input, dt);
  else dive(s, input, dt);
  if (s.phase === 'dive' && balanceOf(s) >= BAL_DEAD) s.phase = 'wasted';
}

function equalize(s: DiveState, input: GameInput, dt: number) {
  const depthCost = 1 + Math.max(0, s.depth) / 40;
  // 새로 누를 때마다 한 번 (공기가 없으면 누른 것도 안 셈)
  if (input.eq && !s.eqHeld && s.air > 0) {
    s.eqCount += 1;
    s.air = Math.max(0, s.air - PRESS_COST * depthCost);
  }
  s.eqHeld = input.eq;
  s.eqStrength = clamp(input.strength, 0.1, 1);
  s.eqActive = input.eq && s.air > 0;
  if (s.eqActive) {
    const k = s.eqStrength;
    s.earP += EQ_RATE * k * dt;
    s.air = Math.max(0, s.air - (HOLD_BASE + HOLD_STRENGTH * k * k) * depthCost * dt);
  }
  const amb = ambientAt(s.depth);
  if (s.phase === 'surface') {
    // 수면: 떼면 다시 완전한 평형(첫 번째 선)으로
    if (!s.eqActive) s.earP = approach(s.earP, amb, 3, dt);
  } else if (s.earP > amb && !s.eqActive) {
    s.earP = approach(s.earP, amb, VENT, dt);
  }
  // 막대 왼쪽 끝보다 더는 못 밀어 넣음 (그 이상 누르는 건 공기만 씀)
  s.earP = Math.min(s.earP, amb - BAL_MIN);
}

function surface(s: DiveState, input: GameInput, dt: number) {
  const jx = Math.abs(input.jx) > 0.15 ? input.jx : 0;
  s.vx = approach(s.vx, jx * SURFACE_SPEED, 1.6, dt);
  if (Math.abs(input.jx) > 0.2) s.facing = input.jx > 0 ? 1 : -1;
  s.x += s.vx * dt;
  s.depth = 0;
  s.vy = 0;
  s.omega = 0;
  s.freefall = false;
  // 수면에 엎드려 가로로 뜬 자세, 머리는 가는 쪽
  const target = s.facing > 0 ? 0 : Math.PI;
  s.phi = wrap(s.phi + wrap(target - s.phi) * Math.min(1, 6 * dt));
  s.neck = approach(s.neck, 0, 6, dt);
  s.hip = approach(s.hip, 0, 6, dt);
  s.arm = approach(s.arm, 0.1, 4, dt);
  s.kickPower = approach(s.kickPower, Math.min(1, Math.abs(s.vx) / SURFACE_SPEED), 4, dt);
  s.kick += dt * (3 + 4 * s.kickPower);
  // 덕다이브: 옆으로 가다가 조이스틱을 아래로 당기면 물속으로
  if (input.jy > 0.55 && Math.abs(s.vx) > 0.45) duckDive(s);
}

function duckDive(s: DiveState) {
  s.phase = 'dive';
  s.phi = s.facing > 0 ? 1.1 : Math.PI - 1.1;
  // 고꾸라지는 회전이 남아 있어 바로잡아야 함
  s.omega = s.facing * 0.5;
  s.vx *= 0.5;
  s.vy = 0.9;
  s.depth = 0.02;
  s.neck = 0.2;
  s.hip = -0.4;
  s.diveTime = 0;
  s.maxDepth = 0;
  s.zoneSum = 0;
  s.zoneTime = 0;
  s.shallowAt = null;
}

function dive(s: DiveState, input: GameInput, dt: number) {
  s.diveTime += dt;
  const d = Math.max(0, s.depth);
  const lung = lungAt(d);
  const f = s.facing;
  const m = Math.min(1, Math.hypot(input.jx, input.jy));
  const steering = m > 0.18; // 방향을 가리키는 중
  const finning = m >= FIN_ZONE; // 바깥 원까지 밀면 피닝
  const speed = Math.hypot(s.vx, s.vy);
  const psi = Math.atan2(s.vy, s.vx);
  // 프리폴: 10 m 아래에서 차지 않고(손을 떼거나 안쪽 원만) 머리가 아래(±60°)를 향함 → 곧은 자세로 가라앉음
  const headingDown = Math.cos(wrap(s.phi - Math.PI / 2)) > 0.5;
  const freefall = !finning && d > NEUTRAL_DEPTH && headingDown;
  s.freefall = freefall && s.vy > 0.1;
  const streamline = steering || freefall; // 곧은 자세 (안 그러면 올드맨)
  const glide = streamline && !finning; // 차지 않고 미끄러지는 중 — 물의 저항이 적음

  // 머리: 조이스틱 방향으로 돌림. 목이 꺾이는 데는 한계가 있고, 빠를수록 물에 밀려 덜 꺾임
  // 거의 반대쪽을 가리키면 이미 돌기 시작한 쪽으로 계속 (좌우를 오가며 멈칫하지 않게)
  let turn = f * wrap(Math.atan2(input.jy, input.jx) - s.phi);
  if (Math.abs(turn) > 2.5 && Math.abs(s.neck) > 0.25 && Math.sign(turn) !== Math.sign(s.neck)) turn = -turn;
  const want = steering ? clamp(turn, -NECK_MAX, NECK_MAX) / (1 + 0.5 * speed) : freefall ? 0 : 0.1;
  s.neck = approach(s.neck, want, 6, dt);

  // 바깥 원부터 피닝, 멀리 밀수록 세게 찬다
  s.kickPower = approach(s.kickPower, finning ? 0.3 + 0.7 * (m - FIN_ZONE) / (1 - FIN_ZONE) : 0, 2.5, dt);
  const stroke = dt * (3.5 + 5 * s.kickPower);
  s.kick += stroke;
  // 피닝 5번에 폐 공기 1%: 실제로 차는 동안 다리 왕복(2π)마다 한 번
  if (s.kickPower > 0.15) {
    s.finPhase += stroke;
    while (s.finPhase >= TWO_PI) {
      s.finPhase -= TWO_PI;
      s.finCount += 1;
      s.air = Math.max(0, s.air - FIN_COST);
    }
  }

  // 몸통 회전: 관성이 커서 넘치고, 부력 · 물살 · 발차기가 계속 흔듦 → 아래만 가리킨다고 곧게 내려가지 않음
  let tau = 2.4 * f * s.neck * (0.3 + s.kickPower); // 몸은 머리를 따라 돈다
  tau += 1.4 * clamp((lung - 0.3) / 0.7, 0, 1) * Math.sin(wrap(-Math.PI / 2 - s.phi)); // 얕을수록 폐(가슴)가 떠서 머리가 들림 — 거꾸로 서 있기가 불안정, 깊으면 폐가 눌려 거의 없음
  if (speed > 0.05) tau += 1.1 * speed * speed * Math.sin(wrap(psi - s.phi)); // 핀이 물살에 끌려 가는 방향으로 정렬 (뒤로 가면 뒤집힘)
  if (freefall && !steering) tau += 0.8 * Math.sin(wrap(Math.PI / 2 - s.phi)); // 프리폴: 손을 떼면 몸을 곧게 펴 아래로 떨어짐
  tau += current(s.time + s.seed) * ((glide ? 0.25 : 0.45) + 0.9 * s.kickPower + (glide ? 0.3 : 0.5) * speed); // 물살 (곧게 미끄러질 땐 덜 흔들림)
  tau += 0.8 * s.kickPower * Math.sin(s.kick); // 발차기마다 몸이 흔들림
  tau -= 0.8 * s.omega;
  s.omega += tau * dt;
  s.phi = wrap(s.phi + s.omega * dt);

  // 다리: 가만히 있으면 올드맨(엉덩이를 접어 다리가 앞으로), 움직이면 물에 밀려 가는 반대쪽으로 끌려감, 몸이 돌면 늦게 따라옴
  const restHip = streamline ? 0.08 : 0.55;
  const flow = clamp(speed, 0, 1);
  const trail = clamp(f * wrap(s.phi - psi), -0.9, 0.9);
  s.hip += 0.5 * f * s.omega * dt;
  s.hip = approach(s.hip, restHip + (trail - restHip) * flow * 0.6, 3, dt);
  s.arm = approach(s.arm, streamline ? 0.12 : 0.7, 2, dt);

  // 추진: 몸통 방향으로, 몸이 꺾여 있으면 힘이 샘
  const bend = Math.abs(s.neck) * 0.6 + Math.abs(s.hip);
  const eff = Math.max(0, Math.cos(Math.min(1.5, bend)));
  const up = Math.max(0, -Math.sin(s.phi)); // 머리가 위를 향한 정도
  const thrust = 1.3 * (1 + ASCENT_BOOST * up) * s.kickPower * (0.55 + 0.45 * Math.abs(Math.sin(s.kick))) * eff;
  let ax = thrust * Math.cos(s.phi);
  let ay = thrust * Math.sin(s.phi);
  ay -= BUOYANCY * (lung - NEUTRAL_LUNG);
  // 물의 저항: 몸이 옆으로 물을 맞거나 꺾여 있으면 커짐
  const side = Math.abs(Math.sin(wrap(psi - s.phi)));
  const cd = (glide ? 0.35 : 0.5) * (1 + 2.5 * side + 1.2 * bend);
  const lin = glide ? 0.12 : 0.2;
  ax -= cd * speed * s.vx + lin * s.vx;
  ay -= cd * speed * s.vy + lin * s.vy;
  s.vx += ax * dt;
  s.vy += ay * dt;
  s.x += s.vx * dt;
  s.depth += s.vy * dt;
  if (s.depth > MAX_DEPTH) { s.depth = MAX_DEPTH; s.vy = Math.min(0, s.vy); }
  s.maxDepth = Math.max(s.maxDepth, s.depth);

  if (s.vy > 0.05 && s.depth > 1) {
    s.zoneSum += closeness(balanceOf(s)) * dt;
    s.zoneTime += dt;
  }

  // 수면 위로 나오면 끝. 너무 얕게 들어갔다 나온 건 다시 수면에서 시작
  if (s.depth <= 0) {
    s.depth = 0;
    if (s.maxDepth < 1.5) backToSurface(s);
    else s.phase = 'done';
  }
}

function backToSurface(s: DiveState) {
  s.phase = 'surface';
  s.vy = 0;
  s.omega = 0;
  s.shallowAt = s.time;
}

export type Score = {
  total: number;
  depthPts: number;
  airPts: number;
  eqPts: number;
  zonePts: number;
  idealEq: number;
  zoneRate: number;
};

// 0 ~ 100점: 수심 40 + 폐 공기 사용 20 + 이퀄 횟수 15 + 두 번째 선 유지 25
// 폐 공기는 남김없이 다 쓰는 게 잘한 것 (아껴 써서 끝까지 쓰고 깊이 내려가기) — 쓴 만큼 점수
// 수심 말고는 20 m 미만이면 깊이만큼만 쳐 줌 (얕게 다녀와서 점수 받기 방지). WASTED는 0점
export function scoreOf(s: DiveState): Score {
  const d = s.maxDepth;
  const idealEq = Math.max(1, Math.round(d / 4));
  const zoneRate = s.zoneTime > 0 ? s.zoneSum / s.zoneTime : 0;
  if (s.phase === 'wasted') return { total: 0, depthPts: 0, airPts: 0, eqPts: 0, zonePts: 0, idealEq, zoneRate };
  const f = Math.min(1, d / 20);
  const depthPts = 40 * Math.min(1, d / TARGET_DEPTH);
  const airPts = 20 * (1 - s.air) * f;
  const eqPts = 15 * Math.min(1, idealEq / Math.max(1, s.eqCount)) * f;
  const zonePts = 25 * zoneRate * f;
  return { total: clamp(Math.round(depthPts + airPts + eqPts + zonePts), 0, 100), depthPts, airPts, eqPts, zonePts, idealEq, zoneRate };
}

// 서버에 남길 한 판 기록 (총점 + 세부 점수). 서버가 범위와 '총점 = 세부 점수 합'을 확인함
export function recordOf(s: DiveState) {
  const sc = scoreOf(s);
  return {
    score: sc.total,
    details: {
      wasted: s.phase === 'wasted',
      maxDepth: clamp(s.maxDepth, 0, MAX_DEPTH),
      air: clamp(s.air, 0, 1),
      eqCount: s.eqCount,
      idealEq: sc.idealEq,
      zoneRate: clamp(sc.zoneRate, 0, 1),
      diveTime: s.diveTime,
      points: { depth: clamp(sc.depthPts, 0, 40), air: clamp(sc.airPts, 0, 20), eq: clamp(sc.eqPts, 0, 15), zone: clamp(sc.zonePts, 0, 25) },
    },
  };
}
