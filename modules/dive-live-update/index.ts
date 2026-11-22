import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

// 다가오는 다이빙 Live Update (안드로이드 네이티브, android/…/DiveLiveUpdateModule.kt). 옛 바이너리면 null
export type DiveLiveUpdateProps = {
  scheduleId: number; title: string; place: string; timeLabel: string; dayLabel: string;
  category: string; people: number; startAt: number; started?: boolean;
};
type Native = {
  canPost(): boolean;
  canPromote(): boolean;
  show(props: DiveLiveUpdateProps): boolean;
  end(): void;
};
export const DiveLiveUpdate: Native | null = Platform.OS === 'android' ? requireOptionalNativeModule<Native>('DiveLiveUpdate') : null;
