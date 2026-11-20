import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/services/api';
import { Grade, gradeColor, gradeLabel, gradeTextColor, XP_PER_LEVEL } from './grade';
import { measureAvatarTarget, shiftXpEvent, useQuestsOpen, useXpQueue, XpEvent } from './store';

// 등급 · 경험치 애니메이션 (설계 7~9장). 화면 맨 위에 겹쳐 그리고 터치는 막지 않음.
// - 경험치: 가운데 '+20 XP' 페이드인 → 아래에서 막대가 올라옴 → 숫자가 막대에 합쳐지며 채워짐 → 좌측 상단 프로필로 빨려 들어감
//   게임 화면엔 프로필이 없으니 막대만 보였다 페이드아웃
// - 배지(처음 한 번 · 등급이 오를 때): 화면 가득 배지 2초 → 줄어들며 프로필 오른쪽 위로 날아가 박힘. 게임 중이면 게임을 나온 뒤에
const run = (a: Animated.CompositeAnimation) => new Promise<void>(resolve => a.start(() => resolve()));
const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const BAR_W = 240;

export default function GradeOverlay() {
  const queue = useXpQueue();
  const pathname = usePathname();
  const inGame = pathname.startsWith('/game-');
  const head = queue[0];
  // 배지 화면은 게임 중엔 미룸 (경험치는 막대만으로 바로)
  // 퀘스트 화면(모달)이 열려 있으면 그 뒤에 가려지니 닫힌 뒤에
  const questsOpen = useQuestsOpen();
  const blocked = (!!head && head.kind === 'grade' && inGame) || questsOpen;
  const [current, setCurrent] = useState<{ event: XpEvent; key: number; inGame: boolean } | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (current || !head || blocked) return;
    setCurrent({ event: head, key: ++seq.current, inGame });
  }, [current, head, blocked, inGame]);

  if (!current) return null;
  const done = () => { shiftXpEvent(); setCurrent(null); };
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {current.event.kind === 'xp'
        ? <XpGain key={current.key} event={current.event} barOnly={current.inGame} onDone={done} />
        : <BadgeReveal key={current.key} grade={current.event.grade} intro={current.event.intro} onDone={done} />}
    </View>
  );
}

function XpGain({ event, barOnly, onDone }: { event: Extract<XpEvent, { kind: 'xp' }>; barOnly: boolean; onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const numOpacity = useRef(new Animated.Value(0)).current;
  const numScale = useRef(new Animated.Value(0.7)).current;
  const numY = useRef(new Animated.Value(0)).current;
  const barOpacity = useRef(new Animated.Value(0)).current;
  const barY = useRef(new Animated.Value(80)).current;
  const fill = useRef(new Animated.Value(event.before.xp / XP_PER_LEVEL)).current;
  const groupX = useRef(new Animated.Value(0)).current;
  const groupY = useRef(new Animated.Value(0)).current;
  const groupScale = useRef(new Animated.Value(1)).current;
  const groupOpacity = useRef(new Animated.Value(1)).current;
  const lvPop = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState<Grade>(event.before);
  const [target, setTarget] = useState<{ x: number; y: number; size: number } | null>(null);

  const barTop = height * 0.62;
  useEffect(() => {
    let alive = true;
    (async () => {
      const t = Animated.timing;
      // ① 숫자 페이드인
      await run(Animated.parallel([
        t(numOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(numScale, { toValue: 1, friction: 6, useNativeDriver: true }),
      ]));
      // ② 막대가 아래에서 올라오며 페이드인
      await run(Animated.parallel([
        t(barOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        t(barY, { toValue: 0, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]));
      // ③ 숫자가 막대로 내려가 합쳐지고 막대가 참 (레벨이 오르면 꽉 찼다가 0부터, 'Lv n' 튀어 오름)
      await run(Animated.parallel([
        t(numY, { toValue: barTop - height * 0.4, duration: 380, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        t(numScale, { toValue: 0.4, duration: 380, useNativeDriver: true }),
        t(numOpacity, { toValue: 0, duration: 380, useNativeDriver: true }),
      ]));
      const levelsUp = (event.after.gradeIndex * 99 + event.after.level) - (event.before.gradeIndex * 99 + event.before.level);
      if (levelsUp > 0) {
        await run(t(fill, { toValue: 1, duration: 300, useNativeDriver: false }));
        if (!alive) return;
        fill.setValue(0);
        setShown(event.after);
        lvPop.setValue(0);
        Animated.sequence([
          t(lvPop, { toValue: 1, duration: 180, useNativeDriver: true }),
          t(lvPop, { toValue: 0.8, duration: 160, useNativeDriver: true }),
        ]).start();
      }
      await run(t(fill, { toValue: event.after.xp / XP_PER_LEVEL, duration: 380, easing: Easing.out(Easing.quad), useNativeDriver: false }));
      if (!alive) return;
      setShown(event.after);
      await wait(250);
      if (barOnly) {
        // ④ 게임: 그 자리에서 페이드아웃
        await run(t(groupOpacity, { toValue: 0, duration: 400, useNativeDriver: true }));
      } else {
        // ④ 좌측 상단 프로필로 빨려 들어감 + 프로필 테두리가 한 번 반짝
        const rect = await measureAvatarTarget();
        const tx = rect ? rect.x + rect.width / 2 : 16 + 20;
        const ty = rect ? rect.y + rect.height / 2 : insets.top + 30;
        if (!alive) return;
        setTarget({ x: tx, y: ty, size: rect ? rect.width : 40 });
        await run(Animated.parallel([
          t(groupX, { toValue: tx - width / 2, duration: 450, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
          t(groupY, { toValue: ty - (barTop + 20), duration: 450, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
          t(groupScale, { toValue: 0.08, duration: 450, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
          t(groupOpacity, { toValue: 0, duration: 450, easing: Easing.in(Easing.exp), useNativeDriver: true }),
        ]));
        await run(t(pulse, { toValue: 1, duration: 450, useNativeDriver: true }));
      }
      if (alive) onDone();
    })();
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const color = gradeColor(shown) === '#FFFFFF' ? '#00E5FF' : gradeColor(shown);
  return (
    <>
      <Animated.View style={[styles.numWrap, { top: height * 0.4 - 40, opacity: numOpacity, transform: [{ translateY: numY }, { scale: numScale }] }]}>
        <Text style={styles.num}>+{event.xp} XP</Text>
        <Text style={styles.numName}>{event.name}</Text>
      </Animated.View>
      <Animated.View style={[styles.barWrap, {
        top: barTop, left: (width - BAR_W) / 2, opacity: Animated.multiply(barOpacity, groupOpacity),
        transform: [{ translateX: groupX }, { translateY: Animated.add(barY, groupY) }, { scale: groupScale }],
      }]}>
        <View style={styles.barLabelRow}>
          <Animated.Text style={[styles.barLabel, { transform: [{ scale: lvPop.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1.15, 1.45] }) }] }]}>
            {gradeLabel(shown)}
          </Animated.Text>
        </View>
        <View style={styles.bar}>
          <Animated.View style={[styles.barFill, { backgroundColor: color, width: fill.interpolate({ inputRange: [0, 1], outputRange: [0, BAR_W - 4] }) }]} />
        </View>
      </Animated.View>
      {target ? (
        <Animated.View style={[styles.pulse, {
          left: target.x - target.size / 2 - 3, top: target.y - target.size / 2 - 3, width: target.size + 6, height: target.size + 6,
          borderRadius: (target.size + 6) / 2, borderColor: color,
          opacity: pulse.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }) }],
        }]} />
      ) : null}
    </>
  );
}

// 화면 가득 배지 2초 → 프로필 오른쪽 위로 날아가 '툭' 박힘
function BadgeReveal({ grade, intro, onDone }: { grade: Grade; intro: boolean; onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const dim = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.4)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const x = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const BADGE = 150;
  const cy = height * 0.42;

  useEffect(() => {
    let alive = true;
    (async () => {
      const t = Animated.timing;
      await run(Animated.parallel([
        t(dim, { toValue: 1, duration: 350, useNativeDriver: true }),
        t(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }),
        t(textOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]));
      await wait(2000);
      const rect = await measureAvatarTarget();
      // 프로필 사진 오른쪽 위 (레벨 알약 자리)
      const tx = rect ? rect.x + rect.width : 16 + 40;
      const ty = rect ? rect.y : insets.top + 12;
      if (!alive) return;
      await run(Animated.parallel([
        t(textOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        t(dim, { toValue: 0, duration: 600, useNativeDriver: true }),
        t(x, { toValue: tx - width / 2, duration: 600, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        t(y, { toValue: ty - cy, duration: 600, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        t(scale, { toValue: 0.16, duration: 600, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      ]));
      // 툭: 살짝 커졌다 작아지며 사라짐 (그 자리에 진짜 알약이 있음)
      await run(Animated.sequence([
        t(scale, { toValue: 0.24, duration: 110, useNativeDriver: true }),
        t(scale, { toValue: 0.12, duration: 130, useNativeDriver: true }),
        t(opacity, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]));
      if (intro) api.markGradeIntroSeen().catch(() => {});
      if (alive) onDone();
    })();
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Animated.View style={[StyleSheet.absoluteFill, styles.dim, { opacity: dim }]} />
      <Animated.View style={[styles.badge, {
        width: BADGE, height: BADGE, borderRadius: BADGE / 2, left: width / 2 - BADGE / 2, top: cy - BADGE / 2,
        backgroundColor: gradeColor(grade), opacity, transform: [{ translateX: x }, { translateY: y }, { scale }],
      }]}>
        <Text style={[styles.badgeGrade, { color: gradeTextColor(grade) }]}>{grade.grade}</Text>
        <Text style={[styles.badgeLevel, { color: gradeTextColor(grade) }]}>Lv {grade.level}</Text>
      </Animated.View>
      <Animated.View style={[styles.badgeText, { top: cy + BADGE / 2 + 24, opacity: textOpacity }]}>
        <Text style={styles.badgeTitle}>{intro ? `${gradeLabel(grade)}` : `${grade.grade} 등급이 되었어요!`}</Text>
        <Text style={styles.badgeSub}>{intro ? 'AllBlue 활동 등급이 생겼어요!\n퀘스트로 경험치를 모아 보세요' : '프로필 테두리 색이 바뀌었어요'}</Text>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  numWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  num: {
    fontFamily: 'SUIT-Bold', fontSize: 40, color: '#00E5FF',
    textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 10, textShadowOffset: { width: 0, height: 2 },
  },
  numName: { fontFamily: 'SUIT-SemiBold', fontSize: 15, color: 'white', marginTop: 4, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 6 },
  barWrap: {
    position: 'absolute', width: BAR_W, paddingVertical: 10, paddingHorizontal: 0, borderRadius: 16,
    backgroundColor: 'rgba(8,30,53,0.85)', alignItems: 'center',
  },
  barLabelRow: { height: 22, justifyContent: 'center', marginBottom: 6 },
  barLabel: { fontFamily: 'SUIT-Bold', fontSize: 14, color: 'white' },
  bar: { width: BAR_W - 24, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden', padding: 0 },
  barFill: { height: 10, borderRadius: 5, maxWidth: BAR_W - 24 },
  pulse: { position: 'absolute', borderWidth: 3 },
  dim: { backgroundColor: 'rgba(6,24,45,0.88)' },
  badge: {
    position: 'absolute', alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 12,
  },
  badgeGrade: { fontFamily: 'SUIT-Bold', fontSize: 30 },
  badgeLevel: { fontFamily: 'SUIT-Bold', fontSize: 20, marginTop: 2 },
  badgeText: { position: 'absolute', left: 24, right: 24, alignItems: 'center' },
  badgeTitle: { fontFamily: 'SUIT-Bold', fontSize: 24, color: 'white', textAlign: 'center' },
  badgeSub: { fontFamily: 'SUIT-Medium', fontSize: 15, color: 'rgba(255,255,255,0.75)', textAlign: 'center', marginTop: 8, lineHeight: 21 },
});
