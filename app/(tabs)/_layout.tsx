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
import { LiquidGlassView } from '@/utils/liquidGlass';
import GamePickerPopup from '@/features/games/GamePickerPopup';
import { useNewGameBadge } from '@/features/games/newBadge';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [gamesVisible, setGamesVisible] = useState(false);
  const newGame = useNewGameBadge();
  const { user, updateUser } = useAuth();
  // 게임은 지금 admin에게만 보임 (2026-11-12 사용자 지시) — 모두에게 열 땐 true로
  const showGames = user?.level === 'A';
  // 투어 · 커뮤니티 탭은 만드는 동안 admin에게만 보였음 (그동안 다른 사용자는 탭 3개)
  const showTour = true; // 2026-11-09 모두에게 공개 (그 전엔 admin만) — 백엔드 TOURS_OPEN_TO_ALL과 함께
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
        <View style={styles.toolbarLeft}>
          <Pressable
            style={({ pressed }) => [styles.profileButton, pressed && { opacity: 0.6 }]}
            onPress={() => router.push('/profile')}
          >
            {/* 홈 왼쪽 위 프로필 사진: 레벨 배지 없이 (2026-11-08), admin은 처리할 건수만 */}
            <ProfileAvatar profileImage={user?.profileImage} nickname={user?.nickname} showLevel={false} count={adminBadgeText(adminTotal)} />
          </Pressable>
          {/* 프로필 사진 오른쪽 게임 아이콘 → 게임 고르기 팝업. 새 게임은 팝업을 한 번 열 때까지 NEW */}
          {showGames && <Pressable
            accessibilityRole="button"
            accessibilityLabel={newGame.isNew ? '게임, 새 게임 있음' : '게임'}
            onPress={() => { newGame.markSeen(); setGamesVisible(true); }}
            style={({ pressed }) => [styles.gameButton, pressed && { opacity: 0.6 }]}
          >
            <GlassCircle size={38} fallbackStyle={styles.gameIcon}>
              <Ionicons name="game-controller-outline" size={LiquidGlassView ? 21 : 25} color="white" />
            </GlassCircle>
            {newGame.isNew ? <View style={styles.newBadge}><Text style={styles.newBadgeText}>NEW</Text></View> : null}
          </Pressable>}
        </View>

        {/* 가운데 로고를 누르면 홈 (2026-11-09). 홈은 아래 탭 바에 칸이 없고 앱을 열면 처음 보임 */}
        <View pointerEvents="box-none" style={styles.toolbarLogo}>
          <Pressable accessibilityRole="button" accessibilityLabel="홈" hitSlop={8} onPress={() => router.navigate('/')}
            style={({ pressed }) => pressed && { opacity: 0.6 }}>
            <Text style={styles.toolbarTitle}>all<Text style={{ color: '#00E5FF' }}>b</Text>lue</Text>
          </Pressable>
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
      {showGames && <GamePickerPopup visible={gamesVisible} onClose={() => setGamesVisible(false)} />}
    </View>
    </SplitProvider>
  );
}

// iPhone Duo: the system tab bar and its bottom accessory, which iOS moves to the spare strip on the
// right when unfolded. Each tab screen holds its own right pane (SplitScene).
function DuoTabsBody({ showTour, showCommunity }: { showTour: boolean; showCommunity: boolean }) {
  const { activeTab, route } = useActivePane();
  // Where the in-screen '다이빙 만들기' buttons were: the dive list, and the day shown on the right.
  const createDate = activeTab === 'b' ? '' : activeTab === 'calendar' && route?.pathname === '/schedule-daily' ? route.params.date : null;
  return (
    <NativeTabs tintColor={Colors.brand.white} iconColor="rgba(255,255,255,0.55)" backgroundColor={Colors.brand.primary}>
      {/* 시스템 탭 바(지금은 꺼 둠)는 숨긴 탭으로 갈 수 없어서 홈을 첫 탭으로 보여 줌 — 켤 때 다시 볼 것 */}
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf="house" />
        <NativeTabs.Trigger.Label>홈</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="calendar">
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
        <NativeTabs.Trigger.Icon sf="airplane" />
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
          {/* 홈은 첫 화면이라 맨 앞 (안드로이드 뒤로가기도 홈으로). CustomTabBar에 아이콘이 없어 탭 바엔 안 보임 */}
          <Tabs.Screen name="index" />
          <Tabs.Screen name="calendar" />
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
  toolbarLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  profileButton: { width: 40, height: 40 },
  gameButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  gameIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  // 알림 종의 건수 배지와 같은 빨강
  newBadge: { position: 'absolute', right: -6, top: 0, height: 16, paddingHorizontal: 4, borderRadius: 8, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' },
  newBadgeText: { color: 'white', fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
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
