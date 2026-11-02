import { getTabBarBottomPadding, getSideStripBottomGap, SIDE_STRIP_CENTER_SHIFT, TAB_BAR_HEIGHT } from '@/utils/tabBarLayout';
import React, { useEffect, useRef } from 'react';
import { View, Image, Pressable, StyleSheet, Platform, Animated, Easing, LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LiquidGlassView } from '@/utils/liquidGlass';
import type { BottomTabBarProps } from 'expo-router/tabs';
import Colors from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';

type TabIconConfig = {
  pack: 'ionicons' | 'image';
  icon: string;
  iconOutline: string;
  image?: any;
};

const TAB_ICONS: TabIconConfig[] = [
  { pack: 'ionicons', icon: 'calendar', iconOutline: 'calendar-outline' },
  { pack: 'image', icon: '', iconOutline: '', image: require('@/assets/images/icon-snorkel-tab.png') },
  { pack: 'ionicons', icon: 'people', iconOutline: 'people-outline' },
  { pack: 'ionicons', icon: 'chatbubbles', iconOutline: 'chatbubbles-outline' },
];

function TabIcon({ focused, tab }: { focused: boolean; tab: TabIconConfig }) {
  const { pack, icon, iconOutline } = tab;
  const scale = useRef(new Animated.Value(focused ? 1 : 0.9)).current;
  const opacity = useRef(new Animated.Value(focused ? 1 : 0.45)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: focused ? 1 : 0.9,
        damping: 12,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: focused ? 1 : 0.45,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [focused]);

  return (
    <Animated.View style={{ transform: [{ scale }], opacity }}>
      {pack === 'image' ? (
        <Image
          source={tab.image}
          style={{ width: 24, height: 24, tintColor: Colors.brand.white }}
          resizeMode="contain"
        />
      ) : (
        <Ionicons
          name={(focused ? icon : iconOutline) as any}
          size={22}
          color={Colors.brand.white}
        />
      )}
    </Animated.View>
  );
}

// Vertical bar: a rounded rectangle, not a fully rounded (oval-looking) capsule.
const STRIP_RADIUS = 20;

type Props = BottomTabBarProps & {
  // Width of the right safe-area strip to stand the bar up in, instead of floating it at the bottom.
  stripWidth?: number;
  // Closes screens stacked over the tabs; true when it did, so the tab opens even if already selected.
  leaveStack?: () => boolean;
};

export default function CustomTabBar({ state, emitter, navigateToTab, stripWidth, leaveStack }: Props) {
  const insets = useSafeAreaInsets();
  const vertical = stripWidth !== undefined;
  // Vertical: as wide as the strip allows, up to the usual bar height.
  const barSize = vertical ? Math.min(TAB_BAR_HEIGHT, stripWidth - 4) : TAB_BAR_HEIGHT;
  const tabSize = barSize - 8;
  const tabCount = state.routes.length;
  const slideX = useRef(new Animated.Value(0)).current;
  const innerWidthRef = useRef(0);

  useEffect(() => {
    if (innerWidthRef.current > 0) {
      const tabWidth = innerWidthRef.current / tabCount;
      Animated.spring(slideX, {
        toValue: state.index * tabWidth,
        damping: 18,
        stiffness: 180,
        useNativeDriver: true,
      }).start();
    }
  }, [state.index]);

  const onTabRowLayout = (e: LayoutChangeEvent) => {
    const totalWidth = vertical ? e.nativeEvent.layout.height : e.nativeEvent.layout.width;
    const padding = 8; // 4px each side
    innerWidthRef.current = totalWidth - padding;
    const tabWidth = innerWidthRef.current / tabCount;
    slideX.setValue(state.index * tabWidth);
  };

  const content = (
    <View style={[styles.tabRow, vertical && { flexDirection: 'column', width: barSize, height: undefined, borderRadius: STRIP_RADIUS - 4 }]} onLayout={onTabRowLayout}>
      {/* Sliding highlight */}
      {innerWidthRef.current > 0 && (
        <Animated.View
          style={[
            styles.highlight,
            vertical ? {
              width: tabSize,
              height: innerWidthRef.current / tabCount,
              borderRadius: STRIP_RADIUS - 6,
              transform: [{ translateY: slideX }],
            } : {
              width: innerWidthRef.current / tabCount,
              transform: [{ translateX: slideX }],
            },
          ]}
        />
      )}

      {/* Tab buttons */}
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const tab = TAB_ICONS[index];

        const onPress = () => {
          const leftStack = leaveStack?.() ?? false;
          const event = emitter.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if ((leftStack || !isFocused) && !event.defaultPrevented) {
            navigateToTab(route.key);
          }
        };

        return (
          <Pressable key={route.key} onPress={onPress} style={[styles.tab, vertical && { flex: 0, width: tabSize, height: tabSize }]}>
            <TabIcon focused={isFocused} tab={tab} />
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View style={vertical
      ? [styles.stripContainer, { width: stripWidth, right: 0, paddingRight: SIDE_STRIP_CENTER_SHIFT * 2, paddingBottom: getSideStripBottomGap(insets.bottom) }]
      : [styles.container, { paddingBottom: getTabBarBottomPadding(insets.bottom, Platform.OS) }]}>
      {LiquidGlassView ? (
        <LiquidGlassView glassEffectStyle="regular" colorScheme="dark" style={[styles.blurContainer, vertical && { width: barSize, borderRadius: STRIP_RADIUS }]}>
          {content}
        </LiquidGlassView>
      ) : Platform.OS === 'ios' ? (
        <BlurView intensity={60} tint="dark" style={[styles.blurContainer, vertical && { width: barSize, borderRadius: STRIP_RADIUS }]}>
          {content}
        </BlurView>
      ) : (
        <View style={[styles.androidContainer, vertical && { width: barSize, borderRadius: STRIP_RADIUS }]}>
          {content}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  // Fills the right safe-area strip of the window (drawn by StripTabBarHost above all screens);
  // the bar sits at its bottom, level with the screens' bottom content.
  stripContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  blurContainer: {
    width: '100%',
    borderRadius: 28,
    overflow: 'hidden',
  },
  androidContainer: {
    width: '100%',
    borderRadius: 28,
    backgroundColor: 'rgba(2, 50, 90, 0.95)',
    overflow: 'hidden',
  },
  tabRow: {
    flexDirection: 'row',
    height: TAB_BAR_HEIGHT,
    alignItems: 'center',
    padding: 4,
    overflow: 'hidden',
    borderRadius: 24,
  },
  highlight: {
    position: 'absolute',
    top: 4,
    left: 4,
    height: 48,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
  },
});
