import StartupPopups from '@/features/notices/StartupPopups';
import NotificationBell from '@/features/notifications/NotificationBell';
import React, { useState, useRef, useCallback } from 'react';
import { AppState, View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Tabs, useRouter, useFocusEffect } from 'expo-router';
import { hasSideTabStrip } from '@/utils/tabBarLayout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CustomTabBar from '@/components/CustomTabBar';
import { StripTabBarRelay, useStripTabBarSetter } from '@/components/StripTabBarHost';
import SideSheet from '@/components/SideSheet';
import Colors from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import ProfileAvatar from '@/components/ProfileAvatar';
import { adminBadgeText, useAdminPendingCounts } from '@/hooks/useAdminPendingCounts';
import GlassCircle from '@/components/GlassCircle';
import { SplitProvider, PaneHost, useIsSplit, useActivePane } from '@/features/split/SplitPane';
import { NativeTabs } from 'expo-router/native-tabs';
import { Ionicons } from '@expo/vector-icons';
import { DUO_SYSTEM_TABS } from '@/utils/foldable';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const [sheetVisible, setSheetVisible] = useState(false);
  const { user, updateUser } = useAuth();
  // 투어 · 커뮤니티 탭은 만드는 동안 admin에게만 보임 (다른 사용자는 탭 3개 그대로)
  const showTour = user?.level === 'A';
  const showCommunity = true; // 2026-11-06 모두에게 공개 (그 전엔 admin만)
  const router = useRouter();
  const updateUserRef = useRef(updateUser);
  updateUserRef.current = updateUser;
  // 16장: admin이면 프로필 사진에 관리자 기능의 처리할 건수 합계 (프로필 '관리자 기능' 버튼과 같은 숫자)
  const { total: adminTotal, reload: reloadAdminCounts } = useAdminPendingCounts(user?.level === 'A');

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
    void reloadAdminCounts();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') { void refresh(); void reloadAdminCounts(); }
    });
    return () => { active = false; subscription.remove(); };
  }, [user?.id, reloadAdminCounts]));

  return (
    <SplitProvider paneInScenes={DUO_SYSTEM_TABS}>
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Toolbar */}
      <View style={styles.toolbar}>
        <Pressable
          style={({ pressed }) => [styles.profileButton, pressed && { opacity: 0.6 }]}
          onPress={() => router.push('/profile')}
        >
          <ProfileAvatar profileImage={user?.profileImage} nickname={user?.nickname} level={user?.badgeLevel ?? user?.level} count={adminBadgeText(adminTotal)} />
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

      {DUO_SYSTEM_TABS ? <DuoTabsBody showTour={showTour} showCommunity={showCommunity} /> : <TabsBody showTour={showTour} showCommunity={showCommunity} />}

      {user && <StartupPopups key={user.id} userId={user.id} />}

      {/* Side Sheet */}
      <SideSheet visible={sheetVisible} onClose={() => setSheetVisible(false)} />
    </View>
    </SplitProvider>
  );
}

// iPhone Duo: the system tab bar and its bottom accessory, which iOS moves to the spare strip on the
// right when unfolded. Each tab screen holds its own right pane (SplitScene).
function DuoTabsBody({ showTour, showCommunity }: { showTour: boolean; showCommunity: boolean }) {
  const { activeTab, route } = useActivePane();
  // Where the in-screen '다이빙 만들기' buttons were: the dive list, and the day shown on the right.
  const createDate = activeTab === 'b' ? '' : activeTab === 'index' && route?.pathname === '/schedule-daily' ? route.params.date : null;
  return (
    <NativeTabs tintColor={Colors.brand.white} iconColor="rgba(255,255,255,0.55)" backgroundColor={Colors.brand.primary}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf="calendar" />
        <NativeTabs.Trigger.Label>캘린더</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="b">
        {/* 시스템 탭바는 이미지 원래 크기로 그려서, 탭 아이콘 크기(25pt)로 만든 이미지를 씀 */}
        <NativeTabs.Trigger.Icon src={require('@/assets/images/icon-snorkel-tab.png')} />
        <NativeTabs.Trigger.Label>다이빙</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="c">
        <NativeTabs.Trigger.Icon sf="person.2" />
        <NativeTabs.Trigger.Label>친구</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="community" hidden={!showCommunity}>
        <NativeTabs.Trigger.Icon sf="bubble.left.and.bubble.right" />
        <NativeTabs.Trigger.Label>커뮤니티</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="tour" hidden={!showTour}>
        <NativeTabs.Trigger.Icon sf="suitcase.rolling" />
        <NativeTabs.Trigger.Label>투어</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      {createDate !== null && (
        <NativeTabs.BottomAccessory>
          <CreateDiveAccessory date={createDate} />
        </NativeTabs.BottomAccessory>
      )}
    </NativeTabs>
  );
}

function CreateDiveAccessory({ date }: { date: string }) {
  const router = useRouter();
  // 'inline' is the compact form iOS uses when the tab bar is minimized.
  const placement = NativeTabs.BottomAccessory.usePlacement();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="다이빙 만들기"
      onPress={() => router.push({ pathname: '/schedule-add', params: { date } })}
      style={({ pressed }) => [styles.accessory, pressed && { opacity: 0.6 }]}
    >
      <Ionicons name="add" size={20} color={Colors.brand.white} />
      {placement === 'regular' && <Text style={styles.accessoryText}>다이빙 만들기</Text>}
    </Pressable>
  );
}

// Unfolded, the tab screen takes the left half and screens opened from it the right half.
function TabsBody({ showTour, showCommunity }: { showTour: boolean; showCommunity: boolean }) {
  const isSplit = useIsSplit();
  const insets = useSafeAreaInsets();
  // With a side strip the bar is drawn by StripTabBarHost above every screen, not inside the left half.
  const setStripBar = useStripTabBarSetter();
  const strip = hasSideTabStrip(insets.right, Platform.OS) && setStripBar !== null;
  return (
    <View style={styles.body}>
      <View style={styles.half}>
        <Tabs
          tabBar={(props) => strip ? <StripTabBarRelay {...props} onChange={setStripBar} /> : <CustomTabBar {...props} />}
          screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: '#144A84' } }}
        >
          <Tabs.Screen name="index" />
          <Tabs.Screen name="b" />
          <Tabs.Screen name="c" />
          {/* 막히면 탭 바에서 빠지고, 주소로 열어도 첫 탭으로 돌아감 */}
          <Tabs.Protected guard={showCommunity}>
            <Tabs.Screen name="community" />
          </Tabs.Protected>
          <Tabs.Protected guard={showTour}>
            <Tabs.Screen name="tour" />
          </Tabs.Protected>
        </Tabs>
      </View>
      {isSplit && (
        <View style={[styles.half, styles.paneHalf]}>
          <PaneHost />
        </View>
      )}
    </View>
  );
}


const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.brand.primary,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
  },
  // Equal flex keeps the two halves exactly 1:1.
  half: {
    flex: 1,
  },
  accessory: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
  },
  accessoryText: {
    fontFamily: 'SUIT-Bold',
    fontSize: 15,
    color: Colors.brand.white,
  },
  paneHalf: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: 'rgba(255,255,255,0.12)',
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
