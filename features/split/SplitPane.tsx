import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/Colors';

// Unfolded foldables (iPhone Duo inner display, Galaxy Z Fold) split the tab screens 1:1:
// the tab screen stays on the left and screens opened from it show on the right.
// Decided by window width, not by fold state, as Apple and Google recommend.
export const SPLIT_MIN_WIDTH = 600;

export type PaneTab = 'index' | 'b' | 'c';
type Params = Record<string, string>;
const PANE_PATHS = ['/schedule-daily', '/schedule-detail', '/profile-view', '/achievement', '/debriefing'] as const;
type PanePath = typeof PANE_PATHS[number];
type PaneRoute = { key: number; pathname: PanePath; params: Params };
type Href = string | { pathname: string; params?: Record<string, unknown> };
// What the right pane shows while nothing is open: a screen (calendar: today) or a friendly placeholder.
export type PaneDefault = { pathname: PanePath; params: Params } | { message: string; hint: string };

// Loaded lazily: the pane screens import this module for their router and params.
const getPaneScreen = (pathname: PanePath): React.ComponentType => {
  switch (pathname) {
    case '/schedule-daily': return require('@/app/schedule-daily').default;
    case '/schedule-detail': return require('@/app/schedule-detail').default;
    case '/profile-view': return require('@/app/profile-view').default;
    case '/achievement': return require('@/app/achievement').default;
    case '/debriefing': return require('@/app/debriefing').default;
  }
};

type SplitValue = {
  isSplit: boolean;
  // iPhone Duo: the system tab bar fills the screen, so each tab screen holds its own pane.
  paneInScenes: boolean;
  activeTab: PaneTab;
  stacks: Record<PaneTab, PaneRoute[]>;
  defaults: Partial<Record<PaneTab, PaneDefault>>;
  open: (route: Omit<PaneRoute, 'key'>, fromPane: boolean) => void;
  pop: () => void;
  setDefault: (tab: PaneTab, value: PaneDefault) => void;
};
const SplitContext = createContext<SplitValue | null>(null);
const PaneScreenContext = createContext<{ route: PaneRoute; index: number } | null>(null);

const TAB_BY_PATH: Record<string, PaneTab> = { '/': 'index', '/b': 'b', '/c': 'c' };
const EMPTY_STACKS: Record<PaneTab, PaneRoute[]> = { index: [], b: [], c: [] };

const toParams = (params?: Record<string, unknown>): Params =>
  Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]));

export function SplitProvider({ children, paneInScenes = false }: { children: React.ReactNode; paneInScenes?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const isSplit = width >= SPLIT_MIN_WIDTH;
  const [stacks, setStacks] = useState(EMPTY_STACKS);
  const [defaults, setDefaults] = useState<Partial<Record<PaneTab, PaneDefault>>>({});
  const tabRef = useRef<PaneTab>('index');
  // Keep the last tab while a full-screen stack screen is on top.
  if (TAB_BY_PATH[pathname]) tabRef.current = TAB_BY_PATH[pathname];
  const activeTab = tabRef.current;
  const nextKey = useRef(0);

  // Folding (or standing the device up) with a screen open on the right: continue on that screen
  // full screen, with back returning to the tab screen.
  const stacksRef = useRef(stacks);
  stacksRef.current = stacks;
  const wasSplit = useRef(isSplit);
  useEffect(() => {
    if (wasSplit.current && !isSplit) {
      for (const route of stacksRef.current[tabRef.current]) router.push({ pathname: route.pathname, params: route.params });
      setStacks(EMPTY_STACKS);
    }
    wasSplit.current = isSplit;
  }, [isSplit, router]);

  const value = useMemo<SplitValue>(() => ({
    isSplit, paneInScenes, activeTab, stacks, defaults,
    open: (route, fromPane) => {
      const entry = { ...route, key: nextKey.current++ };
      // From the left a new choice replaces the right side; from the right it goes one level deeper.
      setStacks((s) => ({ ...s, [activeTab]: fromPane ? [...s[activeTab], entry] : [entry] }));
    },
    pop: () => setStacks((s) => ({ ...s, [activeTab]: s[activeTab].slice(0, -1) })),
    setDefault: (tab, d) => setDefaults((prev) => (JSON.stringify(prev[tab]) === JSON.stringify(d) ? prev : { ...prev, [tab]: d })),
  }), [isSplit, paneInScenes, activeTab, stacks, defaults]);

  return <SplitContext.Provider value={value}>{children}</SplitContext.Provider>;
}

export function useIsSplit() {
  return useContext(SplitContext)?.isSplit ?? false;
}

// True for screens shown inside the right pane.
export function useIsInPane() {
  return useContext(PaneScreenContext) !== null;
}

// The screen currently on top of the active tab's right pane (or its default screen), if any.
export function useActivePane() {
  const split = useContext(SplitContext);
  if (!split?.isSplit) return { activeTab: split?.activeTab ?? 'index', route: null };
  const stack = split.stacks[split.activeTab];
  const fallback = split.defaults[split.activeTab];
  const route = stack.length > 0 ? stack[stack.length - 1] : fallback && 'pathname' in fallback ? fallback : null;
  return { activeTab: split.activeTab, route };
}

// Wraps a tab screen on iPhone Duo: unfolded, the screen takes the left half and its pane the right.
export function SplitScene({ tab, children }: { tab: PaneTab; children: React.ReactNode }) {
  const split = useContext(SplitContext);
  if (!split?.paneInScenes || !split.isSplit) return <>{children}</>;
  return (
    <View style={styles.scene}>
      <View style={styles.sceneHalf}>{children}</View>
      <View style={[styles.sceneHalf, styles.sceneDivider]}><PaneHost tab={tab} /></View>
    </View>
  );
}

// Drop-in for expo-router's router: in split mode, pane screens open on the right.
export function useAppRouter() {
  const router = useRouter();
  const split = useContext(SplitContext);
  const pane = useContext(PaneScreenContext);
  return useMemo(() => ({
    push(href: Href) {
      if (split?.isSplit && typeof href !== 'string' && (PANE_PATHS as readonly string[]).includes(href.pathname)) {
        split.open({ pathname: href.pathname as PanePath, params: toParams(href.params) }, !!pane);
      } else {
        router.push(href as never);
      }
    },
    back() {
      if (pane && split) split.pop();
      else router.back();
    },
    canGoBack() {
      return pane ? pane.index > 0 : router.canGoBack();
    },
    replace: router.replace,
  }), [router, split, pane]);
}

// Drop-in for useLocalSearchParams that also works for screens shown in the right pane.
export function useScreenParams<T extends Record<string, string | undefined>>(): T {
  const local = useLocalSearchParams<T>();
  const pane = useContext(PaneScreenContext);
  return (pane ? pane.route.params : local) as T;
}

// The first screen in the right pane has nothing to go back to, so it hides its back button.
export function useIsPaneRoot() {
  const pane = useContext(PaneScreenContext);
  return pane?.index === 0;
}

export function usePaneDefault(tab: PaneTab, value: PaneDefault) {
  const split = useContext(SplitContext);
  const serialized = JSON.stringify(value);
  const setDefault = split?.setDefault;
  useEffect(() => { setDefault?.(tab, JSON.parse(serialized)); }, [tab, serialized, setDefault]);
}

export function PaneHost({ tab }: { tab?: PaneTab } = {}) {
  const split = useContext(SplitContext);
  const insets = useSafeAreaInsets();
  // The toolbar above already clears the status bar.
  const paneInsets = useMemo(() => ({ ...insets, top: 0 }), [insets]);
  if (!split) return null;
  const paneTab = tab ?? split.activeTab;
  const stack = split.stacks[paneTab];
  const fallback = split.defaults[paneTab];

  let content: React.ReactNode = null;
  if (stack.length > 0) {
    // Keep lower screens mounted so going back restores them as they were.
    content = stack.map((route, index) => {
      const Screen = getPaneScreen(route.pathname);
      return (
        <View key={route.key} style={[StyleSheet.absoluteFill, index !== stack.length - 1 && styles.hidden]}>
          <PaneScreenContext.Provider value={{ route, index }}><Screen /></PaneScreenContext.Provider>
        </View>
      );
    });
  } else if (fallback && 'pathname' in fallback) {
    const Screen = getPaneScreen(fallback.pathname);
    const route = { key: -1, ...fallback };
    content = <PaneScreenContext.Provider value={{ route, index: 0 }}><Screen key={JSON.stringify(fallback)} /></PaneScreenContext.Provider>;
  } else if (fallback) {
    content = <PanePlaceholder message={fallback.message} hint={fallback.hint} />;
  }

  return (
    <SafeAreaInsetsContext.Provider value={paneInsets}>
      <View style={styles.pane}>{content}</View>
    </SafeAreaInsetsContext.Provider>
  );
}

function PanePlaceholder({ message, hint }: { message: string; hint: string }) {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.logo}>all<Text style={styles.logoAccent}>b</Text>lue</Text>
      <Text style={styles.message}>{message}</Text>
      <Text style={styles.hint}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pane: {
    flex: 1,
    backgroundColor: Colors.brand.primary,
  },
  hidden: {
    display: 'none',
  },
  scene: {
    flex: 1,
    flexDirection: 'row',
  },
  // Equal flex keeps the two halves exactly 1:1.
  sceneHalf: {
    flex: 1,
  },
  sceneDivider: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: 'rgba(255,255,255,0.12)',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  // Same face and spacing as the toolbar logo (SUIT-Regular, letterSpacing 4 at 20pt), scaled up.
  logo: {
    fontFamily: 'SUIT-Regular',
    fontSize: 34,
    letterSpacing: 34 * (4 / 20),
    color: Colors.brand.white,
    marginBottom: 8,
  },
  logoAccent: {
    color: '#00E5FF',
  },
  message: {
    fontFamily: 'SUIT-SemiBold',
    fontSize: 16,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
  },
  hint: {
    fontFamily: 'SUIT-Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
  },
});
