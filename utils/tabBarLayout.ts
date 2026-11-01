export const TAB_BAR_HEIGHT = 56;

export function getTabBarBottomPadding(bottomInset: number, platform: string): number {
  return platform === 'android' ? bottomInset + 12 : bottomInset / 2 + 4;
}

export function getTabBarContentClearance(bottomInset: number, platform: string): number {
  return TAB_BAR_HEIGHT + getTabBarBottomPadding(bottomInset, platform) + 16;
}

// A right safe-area strip at least this wide (iPhone Duo: status and system buttons on the right)
// holds the tab bar vertically instead of floating it over the bottom of the content.
export const SIDE_TAB_STRIP_MIN = 44;

// With the bar in the side strip: one bottom gap for the bar and every screen's bottom content
// (banner, buttons) — half the usual bottom-safe-area-plus-12 gap, which looked too tall on the Duo.
export function getSideStripBottomGap(bottomInset: number): number {
  return Math.round((bottomInset + 12) / 2);
}

// iOS's status icons in that strip (camera, clock, battery) sit this far left of the strip's center;
// what the app puts in the strip is centered on them instead.
export const SIDE_STRIP_CENTER_SHIFT = 6;

export function hasSideTabStrip(rightInset: number, platform: string): boolean {
  return platform === 'ios' && rightInset >= SIDE_TAB_STRIP_MIN;
}
