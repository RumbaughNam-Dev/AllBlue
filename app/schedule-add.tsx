import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, StyleSheet, Pressable, ScrollView,
  Alert, Platform, KeyboardAvoidingView, ActivityIndicator, Keyboard,
  Animated, Easing, LayoutAnimation, Switch,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Colors from '@/constants/Colors';
import { api } from '@/services/api';
import BottomSheet from '@/components/BottomSheet';
import DatePickerSheet from '@/components/DatePickerSheet';
import LevelBadge from '@/components/LevelBadge';
import Spinner from '@/components/Spinner';
import { api as friendApi, CloseFriend } from '@/services/api';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

const CATEGORIES = [
  { code: 'EXPERIENCE', label: '체험교육' },
  { code: 'CERTIFICATION', label: '자격증 과정' },
  { code: 'LECTURE', label: '특강' },
  { code: 'TRAINING', label: '트레이닝' },
  { code: 'FUN_DIVE', label: '펀다이빙' },
  { code: 'ETC', label: '기타' },
];

const STUDENT_CATEGORIES = ['EXPERIENCE', 'CERTIFICATION', 'LECTURE'];

type Pool = { id: number; name: string };
type UserResult = { id: number; nickname: string; name?: string; phone: string; birthDate?: string; level?: string | number | null; isGuest?: boolean };

export default function ScheduleAddScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const { date, id, prefillParticipant } = useLocalSearchParams<{ date: string; id?: string; prefillParticipant?: string }>();
  const isEditMode = !!id;

  const [scheduleDate, setScheduleDate] = useState(date || new Date().toISOString().split('T')[0]);
  const dateObj = new Date(scheduleDate + 'T00:00:00');
  const month = dateObj.getMonth() + 1;
  const day = dateObj.getDate();
  const hasDateParam = !!date;

  const [title, setTitle] = useState('');
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);
  const [pools, setPools] = useState<Pool[]>([]);
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [categoryCode, setCategoryCode] = useState('');
  const [participants, setParticipants] = useState<UserResult[]>([]);
  const prefillDone = useRef(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [guestMode, setGuestMode] = useState(false);
  const [guestNickname, setGuestNickname] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const guestIdCounter = useRef(-1);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [visibility, setVisibility] = useState<'public' | 'private'>('private');

  // Picker modals
  const [showPoolPicker, setShowPoolPicker] = useState(false);
  const [showHourPicker, setShowHourPicker] = useState(false);
  const [showMinutePicker, setShowMinutePicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<TextInput>(null);
  const [participantMode, setParticipantMode] = useState(false);
  const [participantTab, setParticipantTab] = useState<'search' | 'friends'>('search');
  const [closeFriends, setCloseFriends] = useState<CloseFriend[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const modeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 신규 등록 시 schedulePublic 설정값으로 기본 공개여부 세팅
    if (!isEditMode) {
      api.getUserSettings()
        .then((res) => {
          setVisibility(res.settings.schedulePublic === 'Y' ? 'public' : 'private');
        })
        .catch(() => {});
    }

    api.getDivingPools()
      .then((res) => {
        const sortedPools = (res.pools ?? []).sort((a, b) => a.id - b.id);
        setPools(sortedPools);

        // 수정 모드: 기존 데이터 로드
        if (isEditMode) {
          setLoadingDetail(true);
          api.getScheduleDetail(Number(id)).then((res) => {
            const s = res.schedule;
            setTitle(s.title);
            setHour(s.startHour);
            setMinute(s.startMinute);
            setCategoryCode(s.categoryCode);
            setVisibility(s.visibility || 'private');
            if (s.poolName) {
              const found = sortedPools.find((p) => p.name === s.poolName);
              if (found) setSelectedPool(found);
            }
            setParticipants(
              s.participants.map((p) => ({
                id: p.id,
                nickname: p.nickname,
                name: p.name,
                phone: '',
                isGuest: p.isGuest,
              }))
            );
          }).catch(() => {}).finally(() => setLoadingDetail(false));
        }
      })
      .catch(() => {});

    // prefill: 친구 목록에서 일정만들기로 진입 시
    if (prefillParticipant && !prefillDone.current) {
      prefillDone.current = true;
      try {
        const p = JSON.parse(prefillParticipant);
        if (p.nickname) {
          api.searchUsers(p.nickname).then((res) => {
            const found = (res.users ?? []).find((u: any) =>
              (p.userId && String(u.id) === String(p.userId)) ||
              u.nickname === p.nickname
            );
            if (found) {
              setParticipants([found]);
            }
          }).catch(() => {});
        }
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (searchQuery.trim().length === 0) {
      setSearchResults([]);
      return;
    }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.searchUsers(searchQuery.trim());
        const filtered = (res.users ?? []).filter(
          (u) => !participants.some((p) => p.id === u.id)
        );
        setSearchResults(filtered);
      } catch {}
      setSearching(false);
    }, 300);
  }, [searchQuery, participants]);

  const addParticipant = (user: UserResult) => {
    setParticipants((prev) => [...prev, user]);
    setSearchQuery('');
    setSearchResults([]);
    setGuestMode(false);
  };

  const enterGuestMode = () => {
    setGuestNickname(searchQuery.trim());
    setGuestPhone('');
    setGuestMode(true);
    setSearchQuery('');
    setSearchResults([]);
  };

  const fetchCloseFriends = async () => {
    setFriendsLoading(true);
    try {
      const res = await friendApi.getCloseFriends();
      setCloseFriends(res.friends ?? []);
    } catch {}
    setFriendsLoading(false);
  };

  const addFriendAsParticipant = async (friend: CloseFriend) => {
    // 이미 추가된 참가자인지 확인
    if (participants.some((p) => p.nickname === friend.nickname)) return;
    // 검색 API로 INT id를 가져옴
    try {
      const res = await api.searchUsers(friend.nickname);
      const found = (res.users ?? []).find((u) => u.nickname === friend.nickname);
      if (found) {
        addParticipant(found);
      }
    } catch {}
  };

  const addGuestParticipant = () => {
    if (!guestNickname.trim()) {
      Alert.alert('알림', '이름을 입력해주세요.');
      return;
    }
    const id = guestIdCounter.current--;
    addParticipant({
      id,
      nickname: guestNickname.trim(),
      phone: guestPhone.replace(/\D/g, ''),
      isGuest: true,
    });
    setGuestMode(false);
  };

  const removeParticipant = (id: number) => {
    setParticipants((prev) => prev.filter((p) => p.id !== id));
  };

  const participantsBackup = useRef<UserResult[]>([]);

  const enterParticipantMode = () => {
    participantsBackup.current = [...participants];
    setParticipantMode(true);
    setParticipantTab('search');
    navigation.setOptions({ gestureEnabled: false });
    fetchCloseFriends();
    Animated.timing(modeAnim, {
      toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start(() => {
      searchInputRef.current?.focus();
    });
  };

  const cancelParticipantMode = () => {
    Keyboard.dismiss();
    setParticipants(participantsBackup.current);
    setSearchQuery('');
    setSearchResults([]);
    setGuestMode(false);
    Animated.timing(modeAnim, {
      toValue: 0, duration: 250, easing: Easing.in(Easing.cubic), useNativeDriver: false,
    }).start(() => {
      setParticipantMode(false);
      navigation.setOptions({ gestureEnabled: true });
    });
  };

  const confirmParticipantMode = () => {
    Keyboard.dismiss();
    setSearchQuery('');
    setSearchResults([]);
    setGuestMode(false);
    Animated.timing(modeAnim, {
      toValue: 0, duration: 250, easing: Easing.in(Easing.cubic), useNativeDriver: false,
    }).start(() => {
      setParticipantMode(false);
      navigation.setOptions({ gestureEnabled: true });
    });
  };

  const selectedCategory = CATEGORIES.find((c) => c.code === categoryCode);
  const isStudentType = STUDENT_CATEGORIES.includes(categoryCode);
  const participantLabel = isStudentType ? '교육생' : '참석자';

  const formOpacity = modeAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const formHeight = modeAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const participantFlex = modeAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  const handleSave = async () => {
    if (!title.trim()) { Alert.alert('알림', '제목을 입력해주세요.'); return; }
    if (!categoryCode) { Alert.alert('알림', '분류를 선택해주세요.'); return; }

    try {
      setSaving(true);
      const appUsers = participants.filter((p) => !p.isGuest);
      const guestUsers = participants.filter((p) => p.isGuest);
      const payload = {
        title: title.trim(),
        scheduleDate: scheduleDate,
        startHour: hour,
        startMinute: minute,
        poolId: selectedPool?.id ?? null,
        categoryCode,
        visibility,
        participantIds: appUsers.map((p) => p.id),
        guests: guestUsers.map((p) => ({ nickname: p.nickname, phone: p.phone || undefined })),
      };

      if (isEditMode) {
        await api.updateSchedule(Number(id), payload);
        Alert.alert('알림', '일정이 수정되었습니다.', [
          { text: '확인', onPress: () => router.back() },
        ]);
      } else {
        await api.createSchedule(payload);
        Alert.alert('알림', '일정이 등록되었습니다.', [
          { text: '확인', onPress: () => router.back() },
        ]);
      }
    } catch (e: any) {
      if (!e._handled) Alert.alert(isEditMode ? '수정 실패' : '등록 실패', e.message ?? '잠시 후 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  const formatBirthDate = (bd?: string) => {
    if (!bd) return '';
    const parts = bd.split('-');
    if (parts.length === 3) {
      return `${Number(parts[0])}년 ${Number(parts[1])}월 ${Number(parts[2])}일`;
    }
    return bd;
  };

  const formatPhone = (p?: string) => {
    if (!p) return '';
    const d = p.replace(/\D/g, '');
    if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
    return p;
  };

  const maskPhone = (p?: string) => {
    if (!p) return '';
    const d = p.replace(/\D/g, '');
    if (d.length === 11) return `${d.slice(0, 3)}-****-${d.slice(7)}`;
    if (d.length === 10) return `${d.slice(0, 3)}-***-${d.slice(6)}`;
    return p;
  };

  const maskEmail = (e?: string) => {
    if (!e) return '';
    const [local, domain] = e.split('@');
    if (!domain) return e;
    const masked = local.length <= 2 ? local : local.slice(0, 2) + '***';
    return `${masked}@${domain}`;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />

      {loadingDetail ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Spinner /></View>
      ) : (
      <>
      {/* Header */}
      <View style={styles.header}>
        {participantMode ? (
          <View style={{ width: 36 }} />
        ) : (
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}>
            <View style={styles.backCircle}>
              <Text style={styles.backArrow}>{'<'}</Text>
            </View>
          </Pressable>
        )}
        <Text style={styles.headerTitle}>
          {participantMode ? participantLabel : isEditMode ? '일정 수정' : '다이빙 만들기'}
        </Text>
        {participantMode ? (
          <Pressable onPress={cancelParticipantMode} style={({ pressed }) => [styles.closeButton, pressed && { opacity: 0.6 }]}>
            <Text style={styles.closeText}>{'✕'}</Text>
          </Pressable>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* 폼 영역 - 참석자 모드에서 접힘 */}
        <Animated.View style={{ opacity: formOpacity, transform: [{ scaleY: formHeight }], overflow: 'hidden' }}>
          {!participantMode && (
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* 제목 */}
              <Text style={styles.label}>제목</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="일정 제목을 입력해주세요"
                placeholderTextColor="rgba(255,255,255,0.25)"
              />

              {/* 장소 */}
              <Text style={styles.label}>장소</Text>
              <Pressable style={styles.pickerButton} onPress={() => { Keyboard.dismiss(); setShowPoolPicker(true); }}>
                <Text style={[styles.pickerText, !selectedPool && styles.pickerPlaceholder]}>
                  {selectedPool?.name ?? '장소를 선택해주세요'}
                </Text>
                <Text style={styles.pickerArrow}>▼</Text>
              </Pressable>

              {/* 날짜 */}
              {!isEditMode && (
                <>
                  <Text style={styles.label}>날짜</Text>
                  <Pressable style={styles.dateInputRow} onPress={() => { Keyboard.dismiss(); setShowDatePicker(true); }}>
                    <Text style={styles.pickerText}>{dateObj.getFullYear()}년 {month}월 {day}일</Text>
                    <Text style={styles.calendarIcon}>📅</Text>
                  </Pressable>
                </>
              )}

              {/* 시간 */}
              <Text style={styles.label}>시간</Text>
              <View style={styles.timeRow}>
                <Pressable style={styles.timePickerButton} onPress={() => { Keyboard.dismiss(); setShowHourPicker(true); }}>
                  <Text style={styles.pickerText}>{String(hour).padStart(2, '0')}</Text>
                  <Text style={styles.pickerArrow}>▼</Text>
                </Pressable>
                <Text style={styles.timeLabel}>시</Text>
                <Pressable style={styles.timePickerButton} onPress={() => { Keyboard.dismiss(); setShowMinutePicker(true); }}>
                  <Text style={styles.pickerText}>{String(minute).padStart(2, '0')}</Text>
                  <Text style={styles.pickerArrow}>▼</Text>
                </Pressable>
                <Text style={styles.timeLabel}>분</Text>
              </View>

              {/* 분류 */}
              <Text style={styles.label}>분류</Text>
              <Pressable style={styles.pickerButton} onPress={() => { Keyboard.dismiss(); setShowCategoryPicker(true); }}>
                <Text style={[styles.pickerText, !selectedCategory && styles.pickerPlaceholder]}>
                  {selectedCategory?.label ?? '분류를 선택해주세요'}
                </Text>
                <Text style={styles.pickerArrow}>▼</Text>
              </Pressable>

              {/* 공개여부 */}
              <Text style={styles.label}>공개여부</Text>
              <View style={styles.visibilityRow}>
                <Text style={styles.visibilityText}>
                  {visibility === 'public' ? '공개' : '비공개'}
                </Text>
                <Switch
                  value={visibility === 'public'}
                  onValueChange={(v) => setVisibility(v ? 'public' : 'private')}
                  trackColor={{ false: 'rgba(255,255,255,0.15)', true: 'rgba(52,199,89,0.5)' }}
                  thumbColor={visibility === 'public' ? Colors.brand.success : 'rgba(255,255,255,0.6)'}
                  style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
                />
              </View>
              <Text style={styles.visibilityDesc}>
                {visibility === 'public'
                  ? '모든 사용자가 이 일정을 볼 수 있습니다.'
                  : '친한친구만 이 일정을 볼 수 있습니다.'}
              </Text>
              <Text style={styles.visibilityDesc}>
                일정 공개여부 기본 설정은 홈 화면 우측 상단 메뉴 {'>'} 일정 설정에서 변경할 수 있습니다.
              </Text>

              <View style={styles.divider} />

              {/* 교육생/참석자 */}
              <Text style={styles.label}>{participantLabel}</Text>

              {/* 참석자 검색 진입 */}
              <Pressable style={styles.participantBox} onPress={enterParticipantMode}>
                {participants.length > 0 ? (
                  <View style={[styles.tagRow, { marginBottom: 0 }]}>
                    {participants.map((p) => (
                      <View key={p.id} style={styles.tagInBox}>
                        <Text style={styles.tagInBoxText}>{p.nickname}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.pickerPlaceholderText}>이름, 전화번호로 검색</Text>
                )}
              </Pressable>
            </ScrollView>
          )}
        </Animated.View>

        {/* 참석자 모드 영역 */}
        {participantMode && (
          <Animated.View style={[styles.participantArea, { flex: 1, opacity: modeAnim }]}>
            {/* 탭: 사용자 검색 / 친한친구 */}
            <View style={styles.participantTabRow}>
              <Pressable
                style={[styles.participantTabItem, participantTab === 'search' && styles.participantTabItemActive]}
                onPress={() => setParticipantTab('search')}
              >
                <Text style={[styles.participantTabText, participantTab === 'search' && styles.participantTabTextActive]}>사용자 검색</Text>
              </Pressable>
              <Pressable
                style={[styles.participantTabItem, participantTab === 'friends' && styles.participantTabItemActive]}
                onPress={() => setParticipantTab('friends')}
              >
                <Text style={[styles.participantTabText, participantTab === 'friends' && styles.participantTabTextActive]}>친한친구</Text>
              </Pressable>
            </View>

            {/* 선택된 참가자 태그 */}
            {participants.length > 0 && (
              <View style={{ marginBottom: 8, gap: 8 }}>
                {participants.map((p) => (
                  <View key={p.id} style={styles.participantCard}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.searchNameRow}>
                        <Text style={styles.tagText}>{p.nickname}{p.name ? ` (${p.name})` : ''}</Text>
                        {p.isGuest
                          ? <View style={styles.guestBadge}><Text style={styles.guestBadgeText}>미사용자</Text></View>
                          : <LevelBadge level={p.level} size={18} />
                        }
                      </View>
                      {p.phone ? <Text style={styles.searchSub}>{maskPhone(p.phone)}</Text> : null}
                    </View>
                    <Pressable onPress={() => removeParticipant(p.id)} style={styles.removeButton}>
                      <Text style={styles.tagRemove}>✕</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {participantTab === 'search' ? (
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* 검색 입력 */}
              <TextInput
                ref={searchInputRef}
                style={styles.input}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="이름, 전화번호로 검색"
                placeholderTextColor="rgba(255,255,255,0.25)"
              />

              {/* 검색 결과 / 게스트 등록 */}
              <View style={{ marginTop: 8 }}>
                {searching && (
                  <View style={styles.searchLoading}>
                    <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" />
                  </View>
                )}
                {/* TODO: 앱 미사용자 등록 - 주석 처리
                {guestMode ? (
                  <View style={styles.guestForm}>
                    <Text style={styles.guestFormTitle}>앱 미사용자 등록</Text>
                    <View style={styles.guestInputGroup}>
                      <Text style={styles.guestInputLabel}>이름</Text>
                      <TextInput
                        style={styles.input}
                        value={guestNickname}
                        onChangeText={setGuestNickname}
                        placeholder="이름을 입력해주세요"
                        placeholderTextColor="rgba(255,255,255,0.25)"
                      />
                    </View>
                    <View style={styles.guestInputGroup}>
                      <Text style={styles.guestInputLabel}>전화번호 (선택)</Text>
                      <TextInput
                        style={styles.input}
                        value={guestPhone}
                        onChangeText={(t) => setGuestPhone(formatPhone(t))}
                        placeholder="010-0000-0000"
                        placeholderTextColor="rgba(255,255,255,0.25)"
                        keyboardType="phone-pad"
                        maxLength={13}
                      />
                    </View>
                    <View style={styles.guestButtons}>
                      <Pressable
                        style={({ pressed }) => [styles.guestCancelButton, pressed && { opacity: 0.7 }]}
                        onPress={() => setGuestMode(false)}
                      >
                        <Text style={styles.guestCancelText}>취소</Text>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [styles.guestAddButton, pressed && { opacity: 0.85 }]}
                        onPress={addGuestParticipant}
                      >
                        <Text style={styles.guestAddText}>등록</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : ( */}
                  {searchResults.length > 0 && (
                    <View style={styles.searchResults}>
                      {searchResults.map((user) => (
                        <Pressable
                          key={user.id}
                          style={({ pressed }) => [styles.searchItem, pressed && { opacity: 0.6 }]}
                          onPress={() => addParticipant(user)}
                        >
                          <View style={{ flex: 1 }}>
                            <View style={styles.searchNameRow}>
                              <Text style={styles.searchName}>
                                {user.nickname}{user.name ? ` (${user.name})` : ''}
                              </Text>
                              <LevelBadge level={user.level} size={18} />
                            </View>
                            {user.phone ? <Text style={styles.searchSub}>{maskPhone(user.phone)}</Text> : null}
                          </View>
                        </Pressable>
                      ))}
                    </View>
                  )}
                {/* 앱 미사용자 등록 버튼 - 주석 처리
                    {searchQuery.trim().length > 0 && !searching && (
                      <Pressable
                        style={({ pressed }) => [styles.guestEntry, pressed && { opacity: 0.6 }]}
                        onPress={enterGuestMode}
                      >
                        <Text style={styles.guestEntryText}>앱 미사용자 등록</Text>
                        <Text style={styles.guestEntryArrow}>{'>'}</Text>
                      </Pressable>
                  )}
                </>
              )} */}
              </View>
            </ScrollView>
            ) : (
            /* 친한친구 목록 */
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {friendsLoading ? (
                <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" />
                </View>
              ) : closeFriends.length === 0 ? (
                <Text style={{ fontFamily: 'SUIT-Regular', fontSize: 14, color: 'rgba(255,255,255,0.3)', textAlign: 'center', paddingTop: 20 }}>
                  친한친구가 없습니다.
                </Text>
              ) : (
                closeFriends
                  .filter((f) => !participants.some((p) => p.nickname === f.nickname))
                  .map((friend) => (
                    <Pressable
                      key={friend.userId}
                      style={({ pressed }) => [styles.searchItem, pressed && { opacity: 0.6 }]}
                      onPress={() => addFriendAsParticipant(friend)}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={styles.searchNameRow}>
                          <Text style={styles.searchName}>
                            {friend.nickname}{friend.name ? ` (${friend.name})` : ''}
                          </Text>
                          <LevelBadge level={friend.level} size={18} />
                        </View>
                        {(friend.phone || friend.email) && (
                          <Text style={styles.searchSub}>
                            {friend.phone ? maskPhone(friend.phone) : ''}{friend.phone && friend.email ? '  ' : ''}{friend.email ? maskEmail(friend.email) : ''}
                          </Text>
                        )}
                      </View>
                      {friend.pinned && <Text style={{ fontSize: 12, marginLeft: 8 }}>📌</Text>}
                    </Pressable>
                  ))
              )}
            </ScrollView>
            )}

            {/* 완료 버튼 */}
            <View style={styles.confirmArea}>
              <Pressable
                style={({ pressed }) => [styles.confirmButton, pressed && { opacity: 0.85 }]}
                onPress={confirmParticipantMode}
              >
                <Text style={styles.confirmText}>완료</Text>
              </Pressable>
            </View>
          </Animated.View>
        )}
      </KeyboardAvoidingView>

      {/* 저장 버튼 - 참석자 모드에서 숨김 */}
      {!participantMode && (
        <View style={styles.bottomArea}>
          <Pressable
            style={({ pressed }) => [styles.saveButton, pressed && { opacity: 0.85 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={Colors.brand.primary} />
            ) : (
              <Text style={styles.saveText}>{isEditMode ? '수정' : '저장'}</Text>
            )}
          </Pressable>
        </View>
      )}

      {/* Picker Modals */}
      <DatePickerSheet
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        selectedDate={scheduleDate}
        onSelect={(v) => setScheduleDate(v)}
      />
      <BottomSheet
        visible={showPoolPicker} onClose={() => setShowPoolPicker(false)} title="장소 선택"
        items={pools.map((p) => ({ label: p.name, value: p }))}
        onSelect={(v) => setSelectedPool(v)}
        selectedValue={selectedPool}
        searchable
      />
      <BottomSheet
        visible={showHourPicker} onClose={() => setShowHourPicker(false)} title="시"
        items={HOURS.map((h) => ({ label: `${String(h).padStart(2, '0')}시`, value: h }))}
        onSelect={(v) => setHour(v)}
        selectedValue={hour}
      />
      <BottomSheet
        visible={showMinutePicker} onClose={() => setShowMinutePicker(false)} title="분"
        items={MINUTES.map((m) => ({ label: `${String(m).padStart(2, '0')}분`, value: m }))}
        onSelect={(v) => setMinute(v)}
        selectedValue={minute}
      />
      <BottomSheet
        visible={showCategoryPicker} onClose={() => setShowCategoryPicker(false)} title="분류 선택"
        items={CATEGORIES.map((c) => ({ label: c.label, value: c.code }))}
        onSelect={(v) => setCategoryCode(v)}
        selectedValue={categoryCode}
      />
      </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brand.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
    paddingHorizontal: 20,
  },
  backButton: { width: 36, height: 36 },
  backCircle: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  backArrow: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.white, marginRight: 1 },
  headerTitle: { fontFamily: 'SUIT-Bold', fontSize: 18, color: Colors.brand.white },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 20 },
  label: {
    fontFamily: 'SUIT-SemiBold', fontSize: 14, color: Colors.brand.white,
    marginTop: 20, marginBottom: 8,
  },
  input: {
    fontFamily: 'SUIT-Regular', fontSize: 16, color: Colors.brand.white,
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  dateInputRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  calendarIcon: {
    fontSize: 18,
  },
  pickerButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  pickerText: { fontFamily: 'SUIT-Regular', fontSize: 16, color: Colors.brand.white },
  pickerPlaceholder: { color: 'rgba(255,255,255,0.25)' },
  pickerPlaceholderText: { fontFamily: 'SUIT-Regular', fontSize: 16, color: 'rgba(255,255,255,0.25)' },
  pickerArrow: { fontSize: 10, color: 'rgba(255,255,255,0.4)' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timePickerButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  timeLabel: { fontFamily: 'SUIT-Regular', fontSize: 16, color: 'rgba(255,255,255,0.6)' },
  visibilityRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 16, height: 50,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  visibilityText: {
    fontFamily: 'SUIT-SemiBold', fontSize: 15, color: Colors.brand.white,
  },
  visibilityDesc: {
    fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.35)',
    marginTop: 6, paddingHorizontal: 4,
  },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 24 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  tagText: { fontFamily: 'SUIT-SemiBold', fontSize: 14, color: Colors.brand.white },
  tagRemove: { fontSize: 14, color: 'rgba(255,255,255,0.5)' },
  participantCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  removeButton: {
    width: 28, height: 28, alignItems: 'center', justifyContent: 'center', marginLeft: 8,
  },
  participantTabRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    marginBottom: 14,
    overflow: 'hidden',
  },
  participantTabItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  participantTabItemActive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  participantTabText: {
    fontFamily: 'SUIT-SemiBold',
    fontSize: 13,
    color: 'rgba(255,255,255,0.35)',
  },
  participantTabTextActive: {
    color: Colors.brand.white,
  },
  participantArea: {
    paddingHorizontal: 24,
  },
  searchLoading: { paddingVertical: 12, alignItems: 'center' },
  searchResults: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
    marginTop: 8, overflow: 'hidden',
  },
  searchItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  searchName: { fontFamily: 'SUIT-SemiBold', fontSize: 15, color: Colors.brand.white },
  searchNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  searchSubRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  searchSub: { fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  bottomArea: { paddingHorizontal: 24, paddingVertical: 12 },
  saveButton: {
    height: 54, borderRadius: 14, backgroundColor: Colors.brand.white,
    alignItems: 'center', justifyContent: 'center',
  },
  saveText: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.primary },
  closeButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 18, color: 'rgba(255,255,255,0.6)' },
  noLevelText: { fontFamily: 'SUIT-Regular', fontSize: 10, color: 'rgba(255,255,255,0.3)', textAlign: 'center', lineHeight: 14 },
  participantBox: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    minHeight: 48, justifyContent: 'center',
  },
  tagInBox: {
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  tagInBoxText: { fontFamily: 'SUIT-SemiBold', fontSize: 13, color: Colors.brand.white },
  confirmArea: { paddingVertical: 12 },
  confirmButton: {
    height: 50, borderRadius: 14, backgroundColor: Colors.brand.white,
    alignItems: 'center', justifyContent: 'center',
  },
  confirmText: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.primary },
  guestEntry: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, marginTop: 8,
  },
  guestEntryText: {
    fontFamily: 'SUIT-SemiBold', fontSize: 14, color: 'rgba(255,255,255,0.5)',
  },
  guestEntryArrow: {
    fontFamily: 'SUIT-Bold', fontSize: 14, color: 'rgba(255,255,255,0.3)',
  },
  guestForm: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
    padding: 16, marginTop: 4,
  },
  guestFormTitle: {
    fontFamily: 'SUIT-Bold', fontSize: 15, color: Colors.brand.white, marginBottom: 16,
  },
  guestInputGroup: { marginBottom: 12 },
  guestInputLabel: {
    fontFamily: 'SUIT-SemiBold', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6,
  },
  guestButtons: {
    flexDirection: 'row', gap: 10, marginTop: 4,
  },
  guestCancelButton: {
    flex: 1, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  guestCancelText: { fontFamily: 'SUIT-SemiBold', fontSize: 14, color: 'rgba(255,255,255,0.5)' },
  guestAddButton: {
    flex: 1, height: 44, borderRadius: 12,
    backgroundColor: Colors.brand.white,
    alignItems: 'center', justifyContent: 'center',
  },
  guestAddText: { fontFamily: 'SUIT-Bold', fontSize: 14, color: Colors.brand.primary },
  guestBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  guestBadgeText: {
    fontFamily: 'SUIT-Regular', fontSize: 11, color: 'rgba(255,255,255,0.4)',
  },
});
