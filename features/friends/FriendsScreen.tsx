import PinnedFriendsList from './PinnedFriendsList';
import PopupBackdrop from '@/components/PopupBackdrop';
import ProfileLink from '@/components/ProfileLink';
import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert, Modal, TextInput, ActivityIndicator, ScrollView, Animated } from 'react-native';

import Colors from '@/constants/Colors';

import ProfileAvatar from '@/components/ProfileAvatar';
import { Ionicons } from '@expo/vector-icons';
import { api, CloseFriend } from '@/services/api';
import { useFriends, FIXED_TABS } from './useFriends';
import { styles } from './styles';

export default function FriendsScreen() {
  const {
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
  } = useFriends();
  const listRef = useRef<FlatList<CloseFriend>>(null);
  const listViewport = useRef<View>(null);
  const scrollOffset = useRef(0);
  const viewport = useRef({ top: 0, height: 0, contentHeight: 0 });
  const [dragging, setDragging] = useState(false);
  const pinnedFriends = activeTab === 'close' ? sortedFriends.filter(friend => friend.pinned) : [];
  const listFriends = activeTab === 'close' ? sortedFriends.filter(friend => !friend.pinned) : sortedFriends;
  const autoScroll = (pageY: number) => {
    const { top, height, contentHeight } = viewport.current;
    const visibleBottom = top + height - bottomSpace - 70;
    const direction = pageY < top + 60 ? -1 : pageY > visibleBottom - 60 ? 1 : 0;
    const next = Math.max(0, Math.min(contentHeight - height, scrollOffset.current + direction * 8));
    if (direction && next !== scrollOffset.current) listRef.current?.scrollToOffset({ offset: next, animated: false });
  };
  const searchBottomClearance = Math.max(insets.bottom, 1);
  const renderFriendCard = ({ item, handle }: { item: CloseFriend; handle?: React.ReactNode }) => (
    <Pressable
      style={styles.friendCard}
      onPress={() => { if (!dragging) handleLongPress(item); }}
    >
      <ProfileLink userId={item.userId} label={item.nickname}><ProfileAvatar profileImage={item.profileImage} nickname={item.nickname} level={item.level} /></ProfileLink>

      <View style={styles.friendInfo}>
        <View style={styles.friendNameRow}>
          <Text style={styles.friendName}>
            {item.nickname}{item.isTemporary ? ' · 임시 사용자' : ''}{item.name && item.name !== item.nickname ? ` | ${item.name}` : ''}
          </Text>
        </View>
        <Text style={styles.friendMemo} numberOfLines={1}>
          {item.memo || '메모를 남겨주세요.'}
        </Text>
      </View>
      {item.pinned && <Ionicons name="pin-outline" size={16} color={Colors.brand.white} style={styles.pinIcon} accessibilityLabel="상단 고정" />}
      {handle}
    </Pressable>
  );

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

      {loadError && (
        <Pressable onPress={fetchFriends} style={{ padding: 16 }}>
          <Text style={styles.emptyText}>친구 목록을 불러오지 못했습니다. 눌러서 다시 시도해주세요.</Text>
        </Pressable>
      )}
      {/* 친구 목록 */}
      <View ref={listViewport} style={{ flex: 1 }} onLayout={() => {
        listViewport.current?.measureInWindow((_x, top, _width, height) => {
          viewport.current = { ...viewport.current, top, height };
        });
      }}>
      <FlatList
        ref={listRef}
        scrollEnabled={!dragging}
        scrollEventThrottle={16}
        onScroll={event => { scrollOffset.current = event.nativeEvent.contentOffset.y; }}
        onContentSizeChange={(_width, contentHeight) => { viewport.current.contentHeight = contentHeight; }}
        ListHeaderComponent={activeTab === 'close' ? <PinnedFriendsList
          friends={pinnedFriends}
          disabled={orderSaving || loading}
          renderFriend={(item, handle) => renderFriendCard({ item, handle })}
          onReorder={reorderPinnedFriends}
          onDraggingChange={setDragging}
          getScrollOffset={() => scrollOffset.current}
          autoScroll={autoScroll}
        /> : null}
        data={listFriends}
        keyExtractor={(item) => item.userId}
        renderItem={renderFriendCard}
        ListEmptyComponent={pinnedFriends.length > 0 ? null : loading ? <ActivityIndicator color="white" /> : loadError ? null : (
          <View style={styles.emptyArea}>
            <Text style={styles.emptyText}>
              {activeTab === 'close' ? '등록된 친한 친구가 없습니다.\n아래 버튼으로 등록해보세요.' :
               activeTab === 'buddy' ? '함께 다이빙한 친구가 없습니다.' :
               activeTab === 'student' ? (isInstructor ? '교육생이 없습니다.' : '강사가 없습니다.') :
               '그룹에 멤버가 없습니다.'}
            </Text>
          </View>
        )}
        contentContainerStyle={[styles.listContent, { paddingBottom: bottomSpace + (activeTab === 'close' ? 70 : 20) }]}
        showsVerticalScrollIndicator={false}
        windowSize={7}
        maxToRenderPerBatch={15}
        removeClippedSubviews={false}
      />
      </View>

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
          <PopupBackdrop />
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
          <PopupBackdrop />
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
          <PopupBackdrop />
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
          <PopupBackdrop />
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
        <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={closeSearchModal}>
        <View style={StyleSheet.absoluteFill} pointerEvents={searchModalVisible ? 'auto' : 'none'}>
          {/* Keep the blur outside opacity animation to preserve background sampling. */}
          <PopupBackdrop />
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: searchBlurAnim }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeSearchModal}>
            </Pressable>
          </Animated.View>

          {/* 바텀시트 */}
          <View style={[styles.searchModalWrap, { paddingTop: insets.top + 16 }]}>
            <View style={{ flex: 1 }} />
            <Animated.View style={[
              styles.searchModalContent,
              {
                // The modal covers the tab bar; reserve only the safe area or keyboard.
                paddingBottom: keyboardAnim.interpolate({
                  inputRange: [0, searchBottomClearance, searchBottomClearance + 1],
                  outputRange: [searchBottomClearance + 16, searchBottomClearance + 16, searchBottomClearance + 17],
                  extrapolate: 'extend',
                }),
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
                {searchError && <Text style={styles.emptyText}>검색 결과를 불러오지 못했습니다. 다시 검색해주세요.</Text>}
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
                    <ProfileLink userId={user.userId} label={user.nickname} beforeOpen={closeSearchModal}><ProfileAvatar profileImage={user.profileImage} nickname={user.nickname} level={user.level} /></ProfileLink>
                    <View style={styles.searchResultInfo}>
                      <View style={styles.searchResultNameRow}>
                        <Text style={styles.searchResultName}>
                          {user.nickname}{user.isTemporary ? ' · 임시 사용자' : ''}{user.name && user.name !== user.nickname ? ` | ${user.name}` : ''}
                        </Text>
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
                {searchQuery.trim().length > 0 && !searching && !searchError && searchResults.length === 0 && (
                  <Text style={styles.searchNoResult}>검색 결과가 없습니다.</Text>
                )}
              </ScrollView>
            </Animated.View>
          </View>
        </View>
        </Modal>
      )}
    </View>
  );
}
