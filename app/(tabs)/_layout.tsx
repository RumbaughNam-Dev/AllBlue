import StartupPopups from '@/features/notices/StartupPopups';
import NotificationBell from '@/features/notifications/NotificationBell';
import React, { useState, useRef, useCallback } from 'react';
import { AppState, View, Text, StyleSheet, Pressable } from 'react-native';
import { Tabs, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CustomTabBar from '@/components/CustomTabBar';
import SideSheet from '@/components/SideSheet';
import Colors from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import ProfileAvatar from '@/components/ProfileAvatar';
import GlassCircle from '@/components/GlassCircle';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const [sheetVisible, setSheetVisible] = useState(false);
  const { user, updateUser } = useAuth();
  const router = useRouter();
  const updateUserRef = useRef(updateUser);
  updateUserRef.current = updateUser;

  useFocusEffect(useCallback(() => {
    if (!user?.id) return;
    let active = true;
    let requestId = 0;
    const refresh = async () => {
      const id = ++requestId;
      try {
        const res = await api.getProfile();
        if (!active || id !== requestId || res.profile?.level == null) return;
        await updateUserRef.current({ level: res.profile.level, badgeLevel: res.profile.badgeLevel ?? null });
      } catch {
        // Retain the cached badge while offline; retry on focus or app return.
      }
    };
    void refresh();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void refresh();
    });
    return () => { active = false; subscription.remove(); };
  }, [user?.id]));

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Toolbar */}
      <View style={styles.toolbar}>
        <Pressable
          style={({ pressed }) => [styles.profileButton, pressed && { opacity: 0.6 }]}
          onPress={() => router.push('/profile')}
        >
          <ProfileAvatar profileImage={user?.profileImage} nickname={user?.nickname} level={user?.badgeLevel ?? user?.level} />
        </Pressable>

        <View pointerEvents="none" style={styles.toolbarLogo}>
          <Text style={styles.toolbarTitle}>all<Text style={{ color: '#00E5FF' }}>b</Text>lue</Text>
        </View>

        <View style={styles.toolbarActions}>
          <NotificationBell key={user?.id} />
          <Pressable
            style={({ pressed }) => pressed && { opacity: 0.6 }}
            onPress={() => setSheetVisible(true)}
          >
            <GlassCircle size={38} fallbackStyle={styles.hamburger}>
              <View style={styles.hamburgerLines}>
                <View style={styles.hamburgerLine} />
                <View style={[styles.hamburgerLine, { width: 16 }]} />
                <View style={styles.hamburgerLine} />
              </View>
            </GlassCircle>
          </Pressable>
        </View>
      </View>

      {/* Tabs */}
      <Tabs
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: '#144A84' } }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="b" />
        <Tabs.Screen name="c" />
      </Tabs>

      {user && <StartupPopups key={user.id} userId={user.id} />}

      {/* Side Sheet */}
      <SideSheet visible={sheetVisible} onClose={() => setSheetVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.brand.primary,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
    paddingHorizontal: 20,
  },
  toolbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  profileButton: { width: 40, height: 40 },
  toolbarLogo: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarTitle: {
    fontFamily: 'SUIT-Regular',
    fontSize: 20,
    color: Colors.brand.white,
    letterSpacing: 4,
  },
  hamburger: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  hamburgerLines: {
    alignItems: 'flex-end',
    gap: 5,
  },
  hamburgerLine: {
    width: 22,
    height: 2,
    borderRadius: 1,
    backgroundColor: Colors.brand.white,
  },
});
