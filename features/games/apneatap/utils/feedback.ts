import * as Haptics from 'expo-haptics';
import {AudioPlayer, createAudioPlayer} from 'expo-audio';

const TAP_POOL_SIZE = 4;
const tapPlayers: AudioPlayer[] = [];
let tapIndex = 0;
let completePlayer: AudioPlayer | null = null;

try {
  for (let i = 0; i < TAP_POOL_SIZE; i++) {
    tapPlayers.push(
      createAudioPlayer(require('@/assets/games/apneatap/tap_ding.wav')),
    );
  }
  completePlayer = createAudioPlayer(
    require('@/assets/games/apneatap/complete_ding.wav'),
  );
} catch {
  // Audio initialization failed — feedback will be haptic-only
}

export function tapFeedback() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  if (tapPlayers.length > 0) {
    try {
      const player = tapPlayers[tapIndex % TAP_POOL_SIZE];
      tapIndex++;
      player.seekTo(0);
      player.play();
    } catch {}
  }
}

let buzzInterval: ReturnType<typeof setInterval> | null = null;

export function startBuzzFeedback() {
  buzzInterval = setInterval(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, 80);
}

export function stopBuzzFeedback() {
  if (buzzInterval) {
    clearInterval(buzzInterval);
    buzzInterval = null;
  }
}

export function completeFeedback() {
  stopBuzzFeedback();
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  if (completePlayer) {
    try {
      completePlayer.seekTo(0);
      completePlayer.play();
    } catch {}
  }
}
