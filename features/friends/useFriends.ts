import AsyncStorage from '@react-native-async-storage/async-storage';
import { readPinnedOrder, sortPinnedFriends } from '@/utils/pinnedFriends';
import { getTabBarContentClearance } from '@/utils/tabBarLayout';
import { maskPhone } from '@/utils/format';
import { useState, useCallback, useRef, useEffect } from 'react';
import { AppState, Alert, TextInput, Platform, Animated, Easing, useWindowDimensions, Keyboard } from 'react-native';

import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/AuthContext';
import { hasInstructorAccess } from '@/utils/userRole';
import { useLatestRequest } from '@/hooks/useLatestRequest';
import { useUserSearch } from '@/hooks/useSearch';

import { api, CloseFriend } from '@/services/api';

export type TabType = string;
export type FriendGroup = { id: number; name: string; memberCount: number };
export const FIXED_TABS = ['close', 'buddy', 'student'];

export function useFriends() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomSpace = getTabBarContentClearance(insets.bottom, Platform.OS);

  const [activeTab, setActiveTab] = useState<TabType>('close');
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const [friends, setFriends] = useState<CloseFriend[]>([]);
  const [pinnedOrder, setPinnedOrder] = useState<string[]>([]);
  const [orderSaving, setOrderSaving] = useState(false);
  const orderSavingRef = useRef(false);
  const accountRef = useRef<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const friendsRequest = useLatestRequest();
  const groupsRequest = useLatestRequest();

  // 그룹
  const [groups, setGroups] = useState<FriendGroup[]>([]);
  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupCreating, setGroupCreating] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);

  // 그룹 선택 (내 그룹에 추가)
  const [groupSelectVisible, setGroupSelectVisible] = useState(false);
  const [groupSelectTarget, setGroupSelectTarget] = useState<CloseFriend | null>(null);

  // 컨텍스트 메뉴
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<CloseFriend | null>(null);

  // 메모 수정
  const [memoModalVisible, setMemoModalVisible] = useState(false);
  const [memoText, setMemoText] = useState('');

  // 친한친구 등록 검색
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchModalMounted, setSearchModalMounted] = useState(false);
  const keyboardAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      Animated.timing(keyboardAnim, {
        toValue: e.endCoordinates.height,
        duration: Platform.OS === 'ios' ? e.duration : 250,
        useNativeDriver: false,
      }).start();
    });
    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      Animated.timing(keyboardAnim, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? (e.duration ?? 250) : 250,
        useNativeDriver: false,
      }).start();
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);
  const {
    height: screenHeight,
  } = useWindowDimensions();
  const searchBlurAnim = useRef(new Animated.Value(0)).current;
  const searchSlideAnim = useRef(new Animated.Value(0)).current; // 0 = hidden, 1 = shown

  const openSearchModal = () => {
    setSearchModalMounted(true);
    setSearchModalVisible(true);
    Animated.parallel([
      Animated.timing(searchBlurAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
      Animated.timing(searchSlideAnim, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start(() => {
      searchInputRef.current?.focus();
    });
  };

  const closeSearchModal = () => {
    setSearchModalVisible(false);
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(searchBlurAnim, { toValue: 0, duration: 250, useNativeDriver: false }),
      Animated.timing(searchSlideAnim, { toValue: 0, duration: 250, easing: Easing.in(Easing.cubic), useNativeDriver: false }),
    ]).start(() => {
      setSearchModalMounted(false);
      setSearchQuery('');
    });
  };
  const [searchQuery, setSearchQuery] = useState('');
  const { results: searchResults, searching, error: searchError } = useUserSearch(searchQuery, searchModalVisible);
  const [addingId, setAddingId] = useState<number | null>(null);
  const searchInputRef = useRef<TextInput>(null);

  const {
    user,
  } = useAuth();
  const orderStorageKey = user?.id ? `pinned-friend-order:${user.id}` : undefined;
  accountRef.current = orderStorageKey;
  const isInstructor = hasInstructorAccess(user?.level);

  const fixedTabs: { key: TabType; label: string }[] = [
    { key: 'close', label: '친한친구' },
    { key: 'buddy', label: '함께한친구' },
    ...(isInstructor ? [{ key: 'student', label: '교육생' }] : []),
  ];

  const allTabs = [
    ...fixedTabs,
    ...groups.map((g) => ({ key: `group_${g.id}`, label: g.name })),
  ];

  const isFixedTab = FIXED_TABS.includes(activeTab);
  const activeGroupId = activeTab.startsWith('group_') ? Number(activeTab.replace('group_', '')) : null;

  const switchTab = (tab: TabType) => {
    activeTabRef.current = tab;
    friendsRequest.invalidate();
    setFriends([]);
    setLoadError(false);
    setActiveTab(tab);
  };

  const fetchGroups = useCallback(async () => {
    const isCurrent = groupsRequest.start();
    try {
      const res = await api.getFriendGroups();
      if (isCurrent()) setGroups(res.groups ?? []);
    } catch {}
  }, []);

  const fetchFriends = useCallback(async () => {
    if (activeTabRef.current !== activeTab) return;
    const latest = friendsRequest.start();
    const isCurrent = () => latest() && activeTabRef.current === activeTab;
    setLoading(true);
    setLoadError(false);
    try {
      let items: CloseFriend[] = [];
      if (activeTab === 'close') {
        const [response, savedOrder] = await Promise.all([
          api.getCloseFriends(),
          orderStorageKey ? AsyncStorage.getItem(orderStorageKey) : Promise.resolve(null),
        ]);
        items = response.friends ?? [];
        if (isCurrent()) setPinnedOrder(readPinnedOrder(savedOrder));
      } else if (activeTab === 'buddy') {
        items = ((await api.getDiveBuddies(1, 50)).buddies ?? []).map((b) => ({
          ...b, memo: b.lastDiveDate ? `마지막 다이빙: ${b.lastDiveDate}` : undefined,
        }));
      } else if (activeTab === 'student' && isInstructor) {
        items = (await api.getStudents()).students ?? [];
      } else if (activeGroupId) {
        items = (await api.getFriendGroupMembers(activeGroupId)).members ?? [];
      }
      if (isCurrent()) setFriends(items);
    } catch {
      if (isCurrent()) setLoadError(true);
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [activeTab, activeGroupId, isInstructor, friendsRequest, orderStorageKey]);

  useEffect(() => {
    if (!isInstructor && activeTab === 'student') switchTab('close');
  }, [isInstructor, activeTab]);

  useFocusEffect(
    useCallback(() => {
      fetchGroups();
      fetchFriends();
      let disposed = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const scheduleRefresh = () => {
        if (activeTab !== 'buddy' || disposed) return;
        timer = setTimeout(async () => {
          if (AppState.currentState === 'active') await fetchFriends();
          scheduleRefresh();
        }, 60_000);
      };
      scheduleRefresh();
      const subscription = activeTab === 'buddy' ? AppState.addEventListener('change', state => {
        if (state === 'active') void fetchFriends();
      }) : undefined;
      return () => {
        disposed = true;
        clearTimeout(timer);
        subscription?.remove();
        friendsRequest.invalidate();
        groupsRequest.invalidate();
      };
    }, [fetchGroups, fetchFriends, friendsRequest, groupsRequest, activeTab])
  );

  const handleCreateGroup = async () => {
    if (!groupName.trim()) return;
    setGroupCreating(true);
    try {
      if (editingGroupId) {
        await api.renameFriendGroup(editingGroupId, groupName.trim());
      } else {
        await api.createFriendGroup(groupName.trim());
      }
      setGroupModalVisible(false);
      setGroupName('');
      setEditingGroupId(null);
      fetchGroups();
    } catch (e: any) {
      console.log('[그룹 에러]', JSON.stringify(e), e?.message);
      Alert.alert('오류', e?.message || (editingGroupId ? '그룹 수정에 실패했습니다.' : '그룹 생성에 실패했습니다.'));
    } finally {
      setGroupCreating(false);
    }
  };

  const handleAddToGroup = (friend: CloseFriend) => {
    if (groups.length === 0) {
      Alert.alert('알림', '먼저 그룹을 추가해주세요.');
      return;
    }
    setGroupSelectTarget(friend);
    closeMenu();
    setTimeout(() => setGroupSelectVisible(true), 100);
  };

  const handleGroupSelect = async (groupId: number) => {
    if (!groupSelectTarget) return;
    setGroupSelectVisible(false);
    try {
      const res = await api.addToFriendGroup(groupId, groupSelectTarget.userId);
      if (res.success) {
        Alert.alert('알림', '그룹에 추가되었습니다.');
      }
    } catch {
      Alert.alert('오류', '그룹 추가에 실패했습니다.');
    } finally {
      setGroupSelectTarget(null);
    }
  };

  const onSearchChange = setSearchQuery;

  const handleSearchAdd = async (user: { id: number; nickname: string; userId?: string }) => {
    if (addingId) return;
    const friendId = user.userId || String(user.id);
    setAddingId(user.id);
    try {
      const res = await api.addCloseFriend(friendId);
      if (!res.success) {
        Alert.alert('알림', res.message || '추가에 실패했습니다.');
      } else {
        Alert.alert('알림', `${user.nickname}님을 친한친구로 추가했습니다.`);
        closeSearchModal();
        fetchFriends();
      }
    } catch {
      Alert.alert('오류', '추가에 실패했습니다.');
    } finally {
      setAddingId(null);
    }
  };

  const handleLongPress = (friend: CloseFriend) => {
    setSelectedFriend(friend);
    setMenuVisible(true);
  };

  const closeMenu = () => {
    setMenuVisible(false);
    setSelectedFriend(null);
  };

  const handlePin = async () => {
    if (!selectedFriend) return;
    closeMenu();
    try {
      await api.toggleCloseFriendPin(selectedFriend.userId, !selectedFriend.pinned);
      fetchFriends();
    } catch {}
  };

  const handleRemoveClose = () => {
    if (!selectedFriend) return;
    closeMenu();
    Alert.alert('확인', '친한친구에서 삭제할까요?', [
      { text: '취소' },
      { text: '삭제', style: 'destructive', onPress: async () => {
        try {
          await api.removeCloseFriend(selectedFriend.userId);
          fetchFriends();
        } catch {}
      }},
    ]);
  };

  const handleAddClose = async () => {
    if (!selectedFriend) return;
    closeMenu();
    try {
      const res = await api.addCloseFriend(selectedFriend.userId);
      if (!res.success) {
        Alert.alert('알림', res.message || '추가에 실패했습니다.');
      } else {
        Alert.alert('알림', '친한친구로 추가되었습니다.');
        fetchFriends();
      }
    } catch {}
  };

  const handleBlock = () => {
    if (!selectedFriend) return;
    closeMenu();
    Alert.alert('확인', '이 유저를 차단할까요?\n차단한 유저는 나의 다이빙 일정을 확인할 수 없습니다.', [
      { text: '취소' },
      { text: '차단', style: 'destructive', onPress: async () => {
        try {
          await api.blockUser(selectedFriend.userId);
          fetchFriends();
        } catch {}
      }},
    ]);
  };

  const memoTargetRef = useRef<CloseFriend | null>(null);

  const handleMemoEdit = () => {
    if (!selectedFriend) return;
    memoTargetRef.current = selectedFriend;
    setMemoText(selectedFriend.memo || '');
    closeMenu();
    setTimeout(() => setMemoModalVisible(true), 100);
  };

  const saveMemo = async () => {
    const target = memoTargetRef.current;
    if (!target) return;
    try {
      await api.updateCloseFriendMemo(target.userId, memoText.trim());
      setMemoModalVisible(false);
      memoTargetRef.current = null;
      fetchFriends();
    } catch {
      Alert.alert('오류', '메모 저장에 실패했습니다.');
    }
  };

  const getMenuItems = (): { label: string; onPress: () => void; danger?: boolean }[] => {
    if (!selectedFriend) return [];

    const items: { label: string; onPress: () => void; danger?: boolean }[] = [
      { label: '프로필 보기', onPress: () => { closeMenu(); router.push({ pathname: '/profile-view', params: { userId: selectedFriend.userId } }); } },
      { label: '메모수정', onPress: handleMemoEdit },
      { label: '일정만들기', onPress: () => {
        const f = selectedFriend;
        closeMenu();
        router.push({
          pathname: '/schedule-add',
          params: {
            date: '',
            prefillParticipant: JSON.stringify({ id: 0, nickname: f.nickname, name: f.name, level: f.level, userId: f.userId }),
          },
        });
      } },
    ];

    if (activeTab === 'close') {
      items.push({ label: selectedFriend.pinned ? '상단고정취소' : '상단고정', onPress: handlePin });
      items.push({ label: '친한친구빼기', onPress: handleRemoveClose, danger: true });
    } else {
      items.push({ label: '친한친구추가', onPress: handleAddClose });
    }

    if (isFixedTab) {
      items.push({ label: '내 그룹에 추가', onPress: () => handleAddToGroup(selectedFriend) });
    }
    items.push({ label: '차단', onPress: handleBlock, danger: true });

    return items;
  };

  const sortedFriends = activeTab === 'close' ? sortPinnedFriends(friends, pinnedOrder) : friends;

  const reorderPinnedFriends = async (ids: string[]) => {
    if (activeTabRef.current !== 'close' || !orderStorageKey || orderSavingRef.current) return;
    const pinned = friends.filter(friend => friend.pinned).map(friend => friend.userId);
    if (ids.length !== pinned.length || new Set(ids).size !== ids.length
      || ids.some(id => !pinned.includes(id))) return;
    const previous = pinnedOrder;
    friendsRequest.invalidate();
    setLoading(false);
    orderSavingRef.current = true;
    setOrderSaving(true);
    setPinnedOrder(ids);
    try {
      await AsyncStorage.setItem(orderStorageKey, JSON.stringify(ids));
    } catch {
      if (accountRef.current === orderStorageKey) {
        setPinnedOrder(previous);
        Alert.alert('저장 실패', '친구 순서를 저장하지 못했습니다. 다시 시도해주세요.');
      }
    } finally {
      orderSavingRef.current = false;
      setOrderSaving(false);
    }
  };

  return {
    insets, bottomSpace, activeTab, loading,
    loadError, groups, groupModalVisible, setGroupModalVisible,
    groupName, setGroupName, groupCreating, editingGroupId,
    setEditingGroupId, groupSelectVisible, setGroupSelectVisible, menuVisible,
    memoModalVisible, setMemoModalVisible, memoText, setMemoText,
    searchModalVisible, searchModalMounted, keyboardAnim, searchBlurAnim,
    searchSlideAnim, openSearchModal, closeSearchModal, searchQuery,
    searchResults, searching, searchError, addingId,
    searchInputRef, user, isInstructor, allTabs,
    switchTab, fetchGroups, fetchFriends, handleCreateGroup,
    handleGroupSelect, onSearchChange, handleSearchAdd, maskPhone,
    handleLongPress, closeMenu, saveMemo, getMenuItems,
    sortedFriends, reorderPinnedFriends, orderSaving,
  };
}
