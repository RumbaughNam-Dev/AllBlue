export const TAB_BAR_HEIGHT = 56;

export function getTabBarBottomPadding(bottomInset: number, platform: string): number {
  return platform === 'android' ? bottomInset + 12 : bottomInset / 2 + 4;
}

export function getTabBarContentClearance(bottomInset: number, platform: string): number {
  return TAB_BAR_HEIGHT + getTabBarBottomPadding(bottomInset, platform) + 16;
}
