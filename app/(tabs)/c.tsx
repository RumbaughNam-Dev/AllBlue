import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, Alert, Modal, TextInput,
  ActivityIndicator, Platform, ScrollView, Animated, Easing,
  useWindowDimensions, Keyboard,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/Colors';
import LevelBadge from '@/components/LevelBadge';
import { Ionicons } from '@expo/vector-icons';
import { api, CloseFriend, DiveBuddy } from '@/services/api';

const TAB_BAR_HEIGHT = 56;

type TabType = string; // 'close' | 'buddy' | 'student' | 'group_{id}'
type FriendGroup = { id: number; name: string; memberCount: number };
const FIXED_TABS = ['close', 'buddy', 'student'];

export default function TabC() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomSpace = TAB_BAR_HEIGHT + (insets.bottom / 2) + 20;

  const [activeTab, setActiveTab] = useState<TabType>('close');
  const [friends, setFriends] = useState<CloseFriend[]>([]);
  const [loading, setLoading] = useState(false);

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
  const { height: screenHeight } = useWindowDimensions();
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
      setSearchResults([]);
    });
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: number; nickname: string; name?: string; phone: string; level?: string | number | null; userId?: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<TextInput>(null);

  // TODO: 강사 여부
  const isInstructor = true;

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
    setFriends([]);
    setActiveTab(tab);
  };

  const fetchGroups = useCallback(async () => {
    try {
      const res = await api.getFriendGroups();
      setGroups(res.groups ?? []);
    } catch {}
  }, []);

  const fetchFriends = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'close') {
        const res = await api.getCloseFriends();
        setFriends(res.friends ?? []);
      } else if (activeTab === 'buddy') {
        const res = await api.getDiveBuddies(1, 50);
        setFriends((res.buddies ?? []).map((b) => ({
          userId: b.userId,
          nickname: b.nickname,
          name: b.name,
          level: b.level,
          memo: b.lastDiveDate ? `마지막 다이빙: ${b.lastDiveDate}` : undefined,
        })));
      } else if (activeTab === 'student') {
        if (isInstructor) {
          const res = await api.getStudents();
          setFriends(res.students ?? []);
        } else {
          const res = await api.getInstructors();
          setFriends(res.instructors ?? []);
        }
      } else if (activeGroupId) {
        const res = await api.getFriendGroupMembers(activeGroupId);
        setFriends(res.members ?? []);
      }
    } catch (e) {
      console.log('[Friends] fetch error:', e);
    }
    setLoading(false);
  }, [activeTab, activeGroupId]);

  useFocusEffect(
    useCallback(() => {
      fetchGroups();
      fetchFriends();
    }, [fetchGroups, fetchFriends])
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

  // 검색 로직
  const onSearchChange = (text: string) => {
    setSearchQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (text.trim().length === 0) {
      setSearchResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.searchUsers(text.trim());
        console.log('[FriendSearch] results:', res.users?.length);
        setSearchResults(res.users ?? []);
      } catch (e) {
        console.log('[FriendSearch] error:', e);
      }
      setSearching(false);
    }, 300);
  };

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

  const maskPhone = (p?: string) => {
    if (!p) return '';
    const d = p.replace(/\D/g, '');
    if (d.length === 11) return `${d.slice(0, 3)}-****-${d.slice(7)}`;
    if (d.length === 10) return `${d.slice(0, 3)}-***-${d.slice(6)}`;
    return p;
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

  const renderFriendCard = ({ item }: { item: CloseFriend }) => (
    <Pressable
      style={styles.friendCard}
      onPress={() => handleLongPress(item)}
    >
      <View style={styles.profileCircle}>
        <Text style={styles.profileInitial}>{item.nickname.charAt(0)}</Text>
      </View>

      <View style={styles.friendInfo}>
        <View style={styles.friendNameRow}>
          <Text style={styles.friendName}>
            {item.nickname}{item.name ? ` | ${item.name}` : ''}
          </Text>
          <LevelBadge level={item.level} size={18} />
        </View>
        <Text style={styles.friendMemo} numberOfLines={1}>
          {item.memo || '메모를 남겨주세요.'}
        </Text>
      </View>
      {item.pinned && <Text style={styles.pinIcon}>📌</Text>}
    </Pressable>
  );

  const sortedFriends = [...friends].sort((a, b) => {
    if (activeTab === 'close') {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
    }
    return 0;
  });

  return (
    <View style={styles.container}>
      {/* 탭 세그먼트 (가로 스크롤) */}
      <View style={styles.tabRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.segmentScroll}
        >
          {allTabs.map((tab) => {
            const isActive = activeTab === tab.key;
            const isCustomGroup = !FIXED_TABS.includes(tab.key);
            return (
              <Pressable
                key={tab.key}
                style={[styles.segmentItem, isActive && styles.segmentItemActive]}
                onPress={() => switchTab(tab.key)}
              >
                <View style={styles.segmentInner}>
                  <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
                    {tab.label}
                  </Text>
                  {isActive && isCustomGroup && (
                    <Pressable
                      onPress={() => {
                        const gId = Number(tab.key.replace('group_', ''));
                        Alert.alert(tab.label, '', [
                          { text: '그룹이름 수정', onPress: () => {
                            setGroupName(tab.label);
                            setEditingGroupId(gId);
                            setGroupModalVisible(true);
                          }},
                          { text: '그룹 삭제', style: 'destructive', onPress: () => {
                            Alert.alert('확인', `"${tab.label}" 그룹을 삭제할까요?`, [
                              { text: '취소' },
                              { text: '삭제', style: 'destructive', onPress: async () => {
                                try {
                                  await api.deleteFriendGroup(gId);
                                  switchTab('close');
                                  fetchGroups();
                                } catch {}
                              }},
                            ]);
                          }},
                          { text: '취소', style: 'cancel' },
                        ]);
                      }}
                      hitSlop={4}
                    >
                      <Ionicons name="settings-outline" size={14} color="rgba(255,255,255,0.5)" style={{ marginLeft: 4 }} />
                    </Pressable>
                  )}
                </View>
              </Pressable>
            );
          })}
          <Pressable
            style={({ pressed }) => [styles.segmentAddButton, pressed && { opacity: 0.6 }]}
            onPress={() => setGroupModalVisible(true)}
          >
            <Text style={styles.segmentAddText}>+</Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* 친구 목록 */}
      <FlatList
        data={sortedFriends}
        keyExtractor={(item) => item.userId}
        renderItem={renderFriendCard}
        ListEmptyComponent={
          <View style={styles.emptyArea}>
            <Text style={styles.emptyText}>
              {activeTab === 'close' ? '친한친구가 없습니다.\n아래 버튼으로 등록해보세요.' :
               activeTab === 'buddy' ? '함께 다이빙한 친구가 없습니다.' :
               activeTab === 'student' ? (isInstructor ? '교육생이 없습니다.' : '강사가 없습니다.') :
               '그룹에 멤버가 없습니다.'}
            </Text>
          </View>
        }
        contentContainerStyle={[styles.listContent, { paddingBottom: bottomSpace + (activeTab === 'close' ? 70 : 20) }]}
        showsVerticalScrollIndicator={false}
        windowSize={7}
        maxToRenderPerBatch={15}
      />

      {/* 친한친구 등록 버튼 */}
      {activeTab === 'close' && (
        <View style={[styles.bottomButtonArea, { bottom: bottomSpace }]}>
          <Pressable
            style={({ pressed }) => [styles.addButton, pressed && { opacity: 0.85 }]}
            onPress={openSearchModal}
          >
            <Text style={styles.addButtonText}>친한친구 등록</Text>
          </Pressable>
        </View>
      )}

      {/* 컨텍스트 메뉴 */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={closeMenu}>
        <Pressable style={styles.menuBackdrop} onPress={closeMenu}>
          <View style={styles.menuContainer}>
            <View style={styles.menuCard}>
              {getMenuItems().map((item, index) => (
                <Pressable
                  key={index}
                  style={({ pressed }) => [
                    styles.menuItem,
                    index < getMenuItems().length - 1 && styles.menuItemBorder,
                    pressed && { backgroundColor: 'rgba(255,255,255,0.05)' },
                  ]}
                  onPress={item.onPress}
                >
                  <Text style={[styles.menuText, item.danger && styles.menuTextDanger]}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* 메모 수정 모달 */}
      <Modal visible={memoModalVisible} transparent animationType="fade" onRequestClose={() => setMemoModalVisible(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setMemoModalVisible(false)}>
          <View style={styles.memoModalContainer}>
            <Pressable style={styles.memoModalCard} onPress={() => {}}>
              <Text style={styles.memoModalTitle}>메모 수정</Text>
              <TextInput
                style={styles.memoInput}
                value={memoText}
                onChangeText={setMemoText}
                placeholder="메모를 입력해주세요"
                placeholderTextColor="rgba(255,255,255,0.25)"
                multiline
                maxLength={200}
                autoFocus
              />
              <View style={styles.memoButtons}>
                <Pressable
                  style={({ pressed }) => [styles.memoCancelButton, pressed && { opacity: 0.7 }]}
                  onPress={() => setMemoModalVisible(false)}
                >
                  <Text style={styles.memoCancelText}>취소</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.memoSaveButton, pressed && { opacity: 0.85 }]}
                  onPress={saveMemo}
                >
                  <Text style={styles.memoSaveText}>저장</Text>
                </Pressable>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* 그룹 생성 모달 */}
      <Modal visible={groupModalVisible} transparent animationType="fade" onRequestClose={() => setGroupModalVisible(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setGroupModalVisible(false)}>
          <View style={styles.memoModalContainer}>
            <Pressable style={styles.memoModalCard} onPress={() => {}}>
              <Text style={styles.memoModalTitle}>{editingGroupId ? '그룹이름 수정' : '그룹 추가'}</Text>
              <TextInput
                style={styles.groupNameInput}
                value={groupName}
                onChangeText={setGroupName}
                placeholder="그룹명을 입력해주세요"
                placeholderTextColor="rgba(255,255,255,0.25)"
                maxLength={20}
                autoFocus
              />
              <View style={styles.memoButtons}>
                <Pressable
                  style={({ pressed }) => [styles.memoCancelButton, pressed && { opacity: 0.7 }]}
                  onPress={() => { setGroupModalVisible(false); setGroupName(''); setEditingGroupId(null); }}
                >
                  <Text style={styles.memoCancelText}>취소</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.memoSaveButton, pressed && { opacity: 0.85 }, groupCreating && { opacity: 0.5 }]}
                  onPress={handleCreateGroup}
                  disabled={groupCreating}
                >
                  {groupCreating ? (
                    <ActivityIndicator size="small" color={Colors.brand.primary} />
                  ) : (
                    <Text style={styles.memoSaveText}>확인</Text>
                  )}
                </Pressable>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* 그룹 선택 모달 */}
      <Modal visible={groupSelectVisible} transparent animationType="fade" onRequestClose={() => setGroupSelectVisible(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setGroupSelectVisible(false)}>
          <View style={styles.menuContainer}>
            <View style={styles.menuCard}>
              <View style={styles.groupSelectHeader}>
                <Text style={styles.groupSelectTitle}>그룹 선택</Text>
              </View>
              {groups.map((g, index) => (
                <Pressable
                  key={g.id}
                  style={({ pressed }) => [
                    styles.menuItem,
                    index < groups.length - 1 && styles.menuItemBorder,
                    pressed && { backgroundColor: 'rgba(255,255,255,0.05)' },
                  ]}
                  onPress={() => handleGroupSelect(g.id)}
                >
                  <Text style={styles.menuText}>{g.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* 친한친구 등록 검색 오버레이 */}
      {searchModalMounted && (
        <View style={StyleSheet.absoluteFill} pointerEvents={searchModalVisible ? 'auto' : 'none'}>
          {/* 블러 배경 */}
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: searchBlurAnim }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeSearchModal}>
              <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
            </Pressable>
          </Animated.View>

          {/* 바텀시트 */}
          <View style={styles.searchModalWrap}>
            <View style={{ flex: 1 }} />
            <Animated.View style={[
              styles.searchModalContent,
              {
                paddingBottom: Animated.add(keyboardAnim, insets.bottom + 16),
                transform: [{ translateY: searchSlideAnim.interpolate({ inputRange: [0, 1], outputRange: [500, 0] }) }],
              },
            ]}>
              {/* 헤더 */}
              <View style={styles.searchModalHeader}>
                <Text style={styles.searchModalTitle}>친한친구 등록</Text>
                <Pressable onPress={closeSearchModal} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
                  <Ionicons name="close" size={24} color="rgba(255,255,255,0.6)" />
                </Pressable>
              </View>

              {/* 검색 입력 */}
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={onSearchChange}
                placeholder="이름, 전화번호, 닉네임으로 검색"
                placeholderTextColor="rgba(255,255,255,0.25)"
              />

              {/* 검색 결과 */}
              <ScrollView style={styles.searchResultsScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {searching && (
                  <View style={styles.searchLoadingArea}>
                    <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" />
                  </View>
                )}
                {searchResults.map((user) => (
                  <Pressable
                    key={user.id}
                    style={({ pressed }) => [styles.searchResultItem, pressed && { opacity: 0.7 }]}
                    onPress={() => handleSearchAdd(user)}
                    disabled={addingId !== null}
                  >
                    <View style={styles.searchResultInfo}>
                      <View style={styles.searchResultNameRow}>
                        <Text style={styles.searchResultName}>
                          {user.nickname}{user.name ? ` | ${user.name}` : ''}
                        </Text>
                        <LevelBadge level={user.level} size={18} />
                      </View>
                      {user.phone ? <Text style={styles.searchResultSub}>{maskPhone(user.phone)}</Text> : null}
                    </View>
                    {addingId === user.id ? (
                      <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" />
                    ) : (
                      <Ionicons name="person-add-outline" size={18} color="rgba(255,255,255,0.4)" />
                    )}
                  </Pressable>
                ))}
                {searchQuery.trim().length > 0 && !searching && searchResults.length === 0 && (
                  <Text style={styles.searchNoResult}>검색 결과가 없습니다.</Text>
                )}
              </ScrollView>
            </Animated.View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brand.primary,
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingLeft: 20,
    paddingRight: 8,
    gap: 8,
  },
  segmentScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  segmentItem: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  segmentInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  segmentItemActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  segmentText: {
    fontFamily: 'SUIT-SemiBold',
    fontSize: 13,
    color: 'rgba(255,255,255,0.35)',
  },
  segmentTextActive: {
    color: Colors.brand.white,
  },
  segmentAddButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentAddText: {
    fontFamily: 'SUIT-Bold',
    fontSize: 18,
    color: 'rgba(255,255,255,0.3)',
  },
  gearButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupSelectHeader: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  groupSelectTitle: {
    fontFamily: 'SUIT-Bold',
    fontSize: 15,
    color: Colors.brand.white,
    textAlign: 'center',
  },
  groupNameInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: 'SUIT-Regular',
    fontSize: 15,
    color: Colors.brand.white,
    marginBottom: 14,
  },
  listContent: {
    paddingHorizontal: 20,
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  profileCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  profileInitial: {
    fontFamily: 'SUIT-Bold',
    fontSize: 18,
    color: 'rgba(255,255,255,0.5)',
  },
  friendInfo: {
    flex: 1,
  },
  friendNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  friendName: {
    fontFamily: 'SUIT-SemiBold',
    fontSize: 15,
    color: Colors.brand.white,
  },
  pinIcon: {
    fontSize: 12,
    marginLeft: 8,
  },
  friendMemo: {
    fontFamily: 'SUIT-Regular',
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },
  emptyArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontFamily: 'SUIT-Regular',
    fontSize: 14,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
    lineHeight: 22,
  },
  bottomButtonArea: {
    position: 'absolute',
    left: 20,
    right: 20,
  },
  addButton: {
    height: 54,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    fontFamily: 'SUIT-Bold',
    fontSize: 16,
    color: Colors.brand.white,
  },

  // 컨텍스트 메뉴
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuContainer: {
    width: '70%',
  },
  menuCard: {
    backgroundColor: 'rgba(30,60,100,0.95)',
    borderRadius: 14,
    overflow: 'hidden',
  },
  menuItem: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  menuText: {
    fontFamily: 'SUIT-SemiBold',
    fontSize: 15,
    color: Colors.brand.white,
  },
  menuTextDanger: {
    color: '#FF6B6B',
  },

  // 메모 수정 모달
  memoModalContainer: {
    width: '85%',
  },
  memoModalCard: {
    backgroundColor: 'rgba(30,60,100,0.95)',
    borderRadius: 14,
    padding: 20,
  },
  memoModalTitle: {
    fontFamily: 'SUIT-Bold',
    fontSize: 16,
    color: Colors.brand.white,
    marginBottom: 14,
  },
  memoInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: 14,
    fontFamily: 'SUIT-Regular',
    fontSize: 14,
    color: Colors.brand.white,
    height: 80,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  memoButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  memoCancelButton: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memoCancelText: {
    fontFamily: 'SUIT-SemiBold',
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
  },
  memoSaveButton: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.brand.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memoSaveText: {
    fontFamily: 'SUIT-Bold',
    fontSize: 14,
    color: Colors.brand.primary,
  },

  // 친한친구 등록 검색 모달
  searchModalWrap: {
    flex: 1,
  },
  searchModalContent: {
    backgroundColor: Colors.brand.primary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
  },
  searchModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 20,
    paddingBottom: 14,
  },
  searchModalTitle: {
    fontFamily: 'SUIT-Bold',
    fontSize: 18,
    color: Colors.brand.white,
  },
  searchInput: {
    fontFamily: 'SUIT-Regular',
    fontSize: 16,
    color: Colors.brand.white,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 12,
  },
  searchResultsScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  searchLoadingArea: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  searchResultName: {
    fontFamily: 'SUIT-SemiBold',
    fontSize: 15,
    color: Colors.brand.white,
  },
  searchResultSub: {
    fontFamily: 'SUIT-Regular',
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },
  searchNoResult: {
    fontFamily: 'SUIT-Regular',
    fontSize: 14,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
    paddingTop: 20,
  },
});
