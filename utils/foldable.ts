import { Platform } from 'react-native';

// iPhone Duo: an iPhone that reports a hinge (iOS 27.1+, built with the 27.1 SDK).
// Only there do we hand the tab bar and the create button to iOS, which places them in the
// spare strip on the right when unfolded. Other devices keep the app's own tab bar.
export const isIPhoneDuo: boolean = (() => {
  if (Platform.OS !== 'ios') return false;
  try {
    return require('expo-hinge').getHinge() !== null;
  } catch {
    // Older store builds without the native module.
    return false;
  }
})();

// iOS stands the system tab bar up in that strip only for apps built with the iOS 27.1 SDK. The current
// store build isn't, so the system bar stayed across the bottom; the iPhone Duo uses the app's own bar
// (vertical in the strip, see CustomTabBar) until then. Set to isIPhoneDuo once built with 27.1.
export const DUO_SYSTEM_TABS: boolean = false;
