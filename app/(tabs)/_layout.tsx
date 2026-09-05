import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CustomTabBar from '@/components/CustomTabBar';
import SideSheet from '@/components/SideSheet';
import Colors from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const [sheetVisible, setSheetVisible] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Toolbar */}
      <View style={styles.toolbar}>
        <Pressable
          style={({ pressed }) => [styles.profileButton, pressed && { opacity: 0.6 }]}
          onPress={() => router.push('/profile')}
        >
          {user?.profileImage ? (
            <Image source={{ uri: user.profileImage }} style={styles.profileImage} />
          ) : (
            <View style={styles.profilePlaceholder}>
              <Text style={styles.profileInitial}>{user?.nickname?.charAt(0) ?? '?'}</Text>
            </View>
          )}
        </Pressable>

        <Text style={styles.toolbarTitle}>all<Text style={{ color: '#00E5FF' }}>b</Text>lue</Text>

        <Pressable
          style={({ pressed }) => [styles.hamburger, pressed && { opacity: 0.6 }]}
          onPress={() => setSheetVisible(true)}
        >
          <View style={styles.hamburgerLine} />
          <View style={[styles.hamburgerLine, { width: 16 }]} />
          <View style={styles.hamburgerLine} />
        </Pressable>
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
  profileButton: {
    width: 40,
    height: 40,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 20,
    padding: 1,
  },
  profileImage: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
  },
  profilePlaceholder: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitial: {
    fontFamily: 'SUIT-Bold',
    fontSize: 16,
    color: Colors.brand.white,
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
