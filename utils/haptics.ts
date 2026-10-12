import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export async function notifyHoldProgress(): Promise<void> {
  try {
    if (Platform.OS === 'android') {
      await Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Frequent_Tick);
    } else if (Platform.OS === 'ios') {
      await Haptics.selectionAsync();
    }
  } catch {
    // Older app binaries or devices without haptics must still allow dragging.
  }
}
