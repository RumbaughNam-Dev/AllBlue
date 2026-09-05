import React, { useEffect, useRef } from 'react';
import { View, Image, Pressable, StyleSheet, Platform, Animated, Easing, LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
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
  { pack: 'image', icon: '', iconOutline: '', image: require('@/assets/images/icon-snorkel.png') },
  { pack: 'ionicons', icon: 'people', iconOutline: 'people-outline' },
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

export default function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
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
    const totalWidth = e.nativeEvent.layout.width;
    const padding = 8; // 4px each side
    innerWidthRef.current = totalWidth - padding;
    const tabWidth = innerWidthRef.current / tabCount;
    slideX.setValue(state.index * tabWidth);
  };

  const content = (
    <View style={styles.tabRow} onLayout={onTabRowLayout}>
      {/* Sliding highlight */}
      {innerWidthRef.current > 0 && (
        <Animated.View
          style={[
            styles.highlight,
            {
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
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable key={route.key} onPress={onPress} style={styles.tab}>
            <TabIcon focused={isFocused} tab={tab} />
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom / 2 + 4 }]}>
      {Platform.OS === 'ios' ? (
        <BlurView intensity={60} tint="dark" style={styles.blurContainer}>
          {content}
        </BlurView>
      ) : (
        <View style={styles.androidContainer}>
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
    height: 56,
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
