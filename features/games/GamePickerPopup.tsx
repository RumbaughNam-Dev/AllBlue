import React, { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import PopupBackdrop from '@/components/PopupBackdrop';
import GlassBackground, { glassClear } from '@/components/GlassBackground';
import FreedivingView from './freediving/FreedivingView';
import { ambientAt, createGame, DiveState } from './freediving/sim';
import { GAME_NAMES } from './games';

// 게임 고르기 (전체 화면): 위쪽 막대 프로필 사진 옆 게임 아이콘을 누르면 열림.
// 상자 없이 게임 화면(캡처)과 이름만 가로로 넘겨 고르고, 누르면 그 게임으로. 닫기는 오른쪽 위 X 하나 (사용자 2026-11-12)
type Game = { key: string; name: string; route: '/game-freediving'; Preview: React.ComponentType<{ width: number; height: number }> };

const GAMES: Game[] = [
  { key: 'freediving', name: GAME_NAMES.freediving, route: '/game-freediving', Preview: FreedivingPreview },
];

// 미리보기 화면은 이 크기로 그린 뒤 카드에 맞게 줄임 (실제 게임 화면과 같은 그림)
const SHOT_W = 390;
const SHOT_H = 760;
const NAME_H = 52; // 캡처 아래 이름 줄 (위 여백 포함)
const GAP = 16;

export default function GamePickerPopup({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const top = insets.top + 64; // 닫기 버튼 아래부터
  const bottom = insets.bottom + 28;
  // 캡처는 화면 폭의 74%까지, 세로가 모자라면 높이에 맞춰 줄임
  const cardW = Math.round(Math.min(width * 0.74, ((height - top - bottom - NAME_H) * SHOT_W) / SHOT_H, 420));
  const shotH = Math.round((cardW * SHOT_H) / SHOT_W);

  const open = (game: Game) => {
    onClose();
    router.push(game.route);
  };

  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <PopupBackdrop />
      <View accessibilityViewIsModal style={[styles.root, { paddingTop: top, paddingBottom: bottom }]}>
        <ScrollView
          horizontal
          style={styles.scroller}
          showsHorizontalScrollIndicator={false}
          snapToInterval={cardW + GAP}
          decelerationRate="fast"
          contentContainerStyle={{ paddingHorizontal: (width - cardW) / 2, gap: GAP }}
        >
          {GAMES.map(game => (
            <Pressable
              key={game.key}
              accessibilityRole="button"
              accessibilityLabel={`${game.name} 시작`}
              onPress={() => open(game)}
              style={({ pressed }) => [{ width: cardW }, pressed && styles.pressed]}
            >
              <View style={[styles.shot, { width: cardW, height: shotH }]}>
                <View style={styles.shotClip}>
                  <game.Preview width={cardW} height={shotH} />
                </View>
              </View>
              <Text style={styles.name} numberOfLines={1}>{game.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="게임 고르기 닫기"
          hitSlop={8}
          style={[styles.close, glassClear, { top: insets.top + 8, right: 16 + insets.right }]}
        >
          <GlassBackground radius={22} interactive />
          <Ionicons name="close" size={28} color="white" />
        </Pressable>
      </View>
    </Modal>
  );
}

// 프리다이빙 미리보기: 14 m쯤에서 머리를 아래로 차고 내려가는 장면, 압력 바늘은 두 번째 선 근처
function FreedivingPreview({ width, height }: { width: number; height: number }) {
  const state = useMemo<DiveState>(() => {
    const s = createGame(3);
    const depth = 14.6;
    return {
      ...s, phase: 'dive', time: 21.4, diveTime: 18.2, x: 0.9, depth, vx: 0.05, vy: 0.95,
      phi: 1.72, neck: -0.18, hip: 0.1, arm: 0.12, kick: 1.1, kickPower: 0.8,
      earP: ambientAt(depth) - 0.26, air: 0.68, eqCount: 4, maxDepth: depth,
    };
  }, []);
  const scale = width / SHOT_W;
  return (
    <View style={{ width, height, overflow: 'hidden' }} pointerEvents="none">
      <View style={{ position: 'absolute', left: (width - SHOT_W) / 2, top: (height - SHOT_H) / 2, transform: [{ scale }] }}>
        <FreedivingView
          state={state}
          cam={{ x: 0.9, y: 14.6 }}
          width={SHOT_W}
          height={SHOT_H}
          insets={{ top: 12, bottom: 8, left: 0, right: 0 }}
          stick={{ x: 0.12, y: 0.86 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // 상자 없이 화면 전체: 뒤 화면을 흐리게 깔고 짙은 바다색으로 덮음 (오른쪽 위 닫기는 사진 크게 보기와 같은 모양)
  root: { flex: 1, justifyContent: 'center', backgroundImage: 'linear-gradient(to bottom, rgba(6,42,77,0.86), rgba(2,14,30,0.97))' },
  scroller: { flexGrow: 0 },
  shot: { borderRadius: 22, boxShadow: '0 18px 44px rgba(0,0,0,0.5)' },
  shotClip: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 22, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', backgroundColor: '#062A4D',
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  name: { fontFamily: 'SUIT-Bold', fontSize: 20, color: Colors.brand.white, textAlign: 'center', marginTop: 16 },
  close: {
    position: 'absolute', width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
    borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)',
  },
});
