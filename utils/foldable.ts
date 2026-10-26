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
