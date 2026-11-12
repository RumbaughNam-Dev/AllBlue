import React, { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/Colors';
import PopupBackdrop from '@/components/PopupBackdrop';
import GlassBackground, { glassClear, PANEL_TINT } from '@/components/GlassBackground';
import FreedivingView from './freediving/FreedivingView';
import { ambientAt, createGame, DiveState } from './freediving/sim';
import { GAME_NAMES } from './games';

// 게임 고르기: 위쪽 막대 프로필 사진 옆 게임 아이콘을 누르면 열림.
// 게임 화면(미리보기)과 이름을 가로로 넘겨 고르고, 누르면 그 게임으로
type Game = { key: string; name: string; route: '/game-freediving'; Preview: React.ComponentType<{ width: number; height: number }> };

const GAMES: Game[] = [
  { key: 'freediving', name: GAME_NAMES.freediving, route: '/game-freediving', Preview: FreedivingPreview },
];

// 미리보기 화면은 이 크기로 그린 뒤 카드에 맞게 줄임 (실제 게임 화면과 같은 그림)
const SHOT_W = 390;
const SHOT_H = 760;

export default function GamePickerPopup({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const panelW = Math.min(400, width - 40 - insets.left - insets.right);
  const inner = panelW - 40;
  const cardW = Math.round(inner * 0.7);
  const gap = 14;
  const side = (inner - cardW) / 2;
  const shotH = Math.round((cardW * SHOT_H) / SHOT_W);

  const open = (game: Game) => {
    onClose();
    router.push(game.route);
  };

  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <PopupBackdrop />
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="닫기" />
      <View style={[styles.center, { paddingLeft: 20 + insets.left, paddingRight: 20 + insets.right }]} pointerEvents="box-none">
        <View style={[styles.panel, glassClear, { width: panelW }]}>
          <GlassBackground radius={20} tintColor={PANEL_TINT} />
          <Text style={styles.title}>게임</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={cardW + gap}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: side, gap, paddingTop: 16 }}
          >
            {GAMES.map(game => (
              <Pressable
                key={game.key}
                accessibilityRole="button"
                accessibilityLabel={`${game.name} 시작`}
                onPress={() => open(game)}
                style={({ pressed }) => [{ width: cardW }, pressed && { opacity: 0.7 }]}
              >
                <View style={[styles.shot, { width: cardW, height: shotH }]}>
                  <game.Preview width={cardW} height={shotH} />
                </View>
                <Text style={styles.name} numberOfLines={1}>{game.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.close, pressed && { opacity: 0.6 }]}>
            <Text style={styles.closeText}>닫기</Text>
          </Pressable>
        </View>
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
  center: { flex: 1, justifyContent: 'center' },
  panel: { alignSelf: 'center', borderRadius: 20, paddingVertical: 20, paddingHorizontal: 20, backgroundColor: Colors.brand.deep },
  title: { fontFamily: 'SUIT-Bold', fontSize: 18, color: Colors.brand.white, textAlign: 'center' },
  shot: { borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: '#062A4D' },
  name: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.white, textAlign: 'center', marginTop: 10 },
  close: {
    height: 50, marginTop: 18, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  closeText: { fontFamily: 'SUIT-SemiBold', fontSize: 15, color: Colors.brand.white },
});
