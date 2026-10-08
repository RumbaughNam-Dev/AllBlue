import NotificationBell from '@/features/notifications/NotificationBell';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CustomTabBar from '@/components/CustomTabBar';
import SideSheet from '@/components/SideSheet';
import Colors from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import ProfileAvatar from '@/components/ProfileAvatar';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const [sheetVisible, setSheetVisible] = useState(false);
  const { user, updateUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && user.level == null) {
      api.getProfile()
        .then((res) => {
          if (res.profile?.level != null) updateUser({ level: res.profile.level });
        })
        .catch(() => {});
    }
  }, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Toolbar */}
      <View style={styles.toolbar}>
        <Pressable
          style={({ pressed }) => [styles.profileButton, pressed && { opacity: 0.6 }]}
          onPress={() => router.push('/profile')}
        >
          <ProfileAvatar profileImage={user?.profileImage} nickname={user?.nickname} level={user?.level} />
        </Pressable>

        <View pointerEvents="none" style={styles.toolbarLogo}>
          <Text style={styles.toolbarTitle}>all<Text style={{ color: '#00E5FF' }}>b</Text>lue</Text>
        </View>

        <View style={styles.toolbarActions}>
          <NotificationBell key={user?.id} />
          <Pressable
            style={({ pressed }) => [styles.hamburger, pressed && { opacity: 0.6 }]}
            onPress={() => setSheetVisible(true)}
          >
            <View style={styles.hamburgerLine} />
            <View style={[styles.hamburgerLine, { width: 16 }]} />
            <View style={styles.hamburgerLine} />
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
    gap: 5,
  },
  hamburgerLine: {
    width: 22,
    height: 2,
    borderRadius: 1,
    backgroundColor: Colors.brand.white,
  },
});
