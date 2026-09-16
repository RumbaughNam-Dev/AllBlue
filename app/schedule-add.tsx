import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, StyleSheet, Pressable, ScrollView,
  Alert, Platform, KeyboardAvoidingView, ActivityIndicator, Keyboard, Switch,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Colors from '@/constants/Colors';
import { api, InProgressLicense, AvailableLicense, Association } from '@/services/api';
import BottomSheet from '@/components/BottomSheet';
import DatePickerSheet from '@/components/DatePickerSheet';
import LevelBadge from '@/components/LevelBadge';
import Spinner from '@/components/Spinner';
import { CloseFriend } from '@/services/api';

const CATEGORIES = [
  { code: 'EXPERIENCE', label: '체험교육' },
  { code: 'CERTIFICATION', label: '자격증 과정' },
  { code: 'LECTURE', label: '특강' },
  { code: 'TRAINING', label: '트레이닝' },
  { code: 'FUN_DIVE', label: '펀다이빙' },
  { code: 'ETC', label: '기타' },
];

const STUDENT_CATEGORIES = ['EXPERIENCE', 'CERTIFICATION', 'LECTURE'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

type Pool = { id: number; name: string };
type UserResult = { id: number; nickname: string; name?: string; phone: string; birthDate?: string; level?: string | number | null; isGuest?: boolean };
type ParticipantEntry = {
  user: UserResult;
  categoryCode: string;
  selectedLicenseIds: number[];
  newLicenses: { licenseId: number; code: string; nameKo: string }[];
};

type Step = 'info' | 'participant';

export default function ScheduleAddScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const { date, id, prefillParticipant } = useLocalSearchParams<{ date: string; id?: string; prefillParticipant?: string }>();
  const isEditMode = !!id;

  // Step
  const [step, setStep] = useState<Step>('info');

  // Schedule info
  const [scheduleDate, setScheduleDate] = useState(date || new Date().toISOString().split('T')[0]);
  const dateObj = new Date(scheduleDate + 'T00:00:00');
  const month = dateObj.getMonth() + 1;
  const day = dateObj.getDate();
  const [title, setTitle] = useState('');
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);
  const [pools, setPools] = useState<Pool[]>([]);
  const [hour, setHour] = useState(() => {
    if (id) return 9; // 수정 모드는 기존 값 로드
    const now = new Date();
    const totalMin = now.getHours() * 60 + now.getMinutes() + 30;
    const snapped = Math.ceil(totalMin / 5) * 5;
    return Math.floor(snapped / 60) % 24;
  });
  const [minute, setMinute] = useState(() => {
    if (id) return 0;
    const now = new Date();
    const totalMin = now.getHours() * 60 + now.getMinutes() + 30;
    const snapped = Math.ceil(totalMin / 5) * 5;
    return snapped % 60;
  });
  const [categoryCode, setCategoryCode] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('private');

  // Confirmed participants
  const [participants, setParticipants] = useState<ParticipantEntry[]>([]);

  // Current participant editing
  const [currentUser, setCurrentUser] = useState<UserResult | null>(null);
  const [currentCategory, setCurrentCategory] = useState('');
  const [currentSelectedLicenseIds, setCurrentSelectedLicenseIds] = useState<number[]>([]);
  const [currentNewLicenses, setCurrentNewLicenses] = useState<{ licenseId: number; code: string; nameKo: string }[]>([]);
  const [inProgressLicenses, setInProgressLicenses] = useState<InProgressLicense[]>([]);
  const [licensesLoading, setLicensesLoading] = useState(false);

  const participantScrollRef = useRef<ScrollView>(null);
  const searchInputLayoutY = useRef(0);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<TextInput>(null);
  const [participantTab, setParticipantTab] = useState<'search' | 'friends'>('search');
  const [closeFriends, setCloseFriends] = useState<CloseFriend[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);

  // License addition
  const [associations, setAssociations] = useState<Association[]>([]);
  const [showAssociationPicker, setShowAssociationPicker] = useState(false);
  const [availableLicenses, setAvailableLicenses] = useState<AvailableLicense[]>([]);
  const [showAvailableLicensePicker, setShowAvailableLicensePicker] = useState(false);

  // Pickers
  const [showPoolPicker, setShowPoolPicker] = useState(false);
  const [showHourPicker, setShowHourPicker] = useState(false);
  const [showMinutePicker, setShowMinutePicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showParticipantCategoryPicker, setShowParticipantCategoryPicker] = useState(false);

  // Other
  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const myUserId = useRef<number | null>(null);

  const selectedCategory = CATEGORIES.find((c) => c.code === categoryCode);
  const participantCategoryLabel = CATEGORIES.find((c) => c.code === currentCategory)?.label ?? '';
  const isStudentType = STUDENT_CATEGORIES.includes(categoryCode);
  const participantLabel = isStudentType ? '교육생' : '참석자';

  // Block back navigation (button + swipe) when there's unsaved input
  const savingRef = useRef(false);
  useEffect(() => { savingRef.current = saving; }, [saving]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      if (savingRef.current) return; // 저장 완료 후 이동 시 방해하지 않음

      if (step === 'participant') {
        e.preventDefault();
        setStep('info');
        return;
      }
      if (!isEditMode && (title.trim() !== '' || selectedPool !== null || categoryCode !== '' || participants.length > 0 || currentUser !== null)) {
        e.preventDefault();
        Alert.alert(
          '확인',
          '등록된 다이빙 일정 정보가 사라집니다.\n취소하시겠어요?',
          [
            { text: '아니오', style: 'cancel' },
            { text: '예', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
          ],
        );
      }
    });
    return unsubscribe;
  }, [navigation, step, title, selectedPool, categoryCode, participants, currentUser, isEditMode]);

  // --- Effects ---

  useEffect(() => {
    api.getProfile()
      .then((res) => { myUserId.current = res.user.id; })
      .catch(() => {});

    if (!isEditMode) {
      api.getUserSettings()
        .then((res) => setVisibility(res.settings.schedulePublic === 'Y' ? 'public' : 'private'))
        .catch(() => {});
    }

    api.getDivingPools()
      .then((res) => {
        const sortedPools = (res.pools ?? []).sort((a, b) => a.id - b.id);
        setPools(sortedPools);

        if (isEditMode) {
          setLoadingDetail(true);
          api.getScheduleDetail(Number(id)).then((res) => {
            const s = res.schedule;
            setTitle(s.title);
            setHour(s.startHour);
            setMinute(s.startMinute);
            setCategoryCode(s.categoryCode);
            setVisibility((s.visibility as 'public' | 'private') || 'private');
            if (s.poolName) {
              const found = sortedPools.find((p) => p.name === s.poolName);
              if (found) setSelectedPool(found);
            }
            setParticipants(
              s.participants.map((p) => ({
                user: { id: p.id, nickname: p.nickname, name: p.name, phone: '', level: p.level, isGuest: p.isGuest },
                categoryCode: p.categoryCode || s.categoryCode,
                selectedLicenseIds: (p.participantLicenses || []).map((l) => l.userLicenseId),
                newLicenses: [],
              }))
            );
          }).catch(() => {}).finally(() => setLoadingDetail(false));
        }
      })
      .catch(() => {});

    if (prefillParticipant) {
      try {
        const p = JSON.parse(prefillParticipant);
        if (p.nickname) {
          api.searchUsers(p.nickname).then((res) => {
            const found = (res.users ?? []).find((u: any) =>
              (p.userId && String(u.id) === String(p.userId)) || u.nickname === p.nickname
            );
            if (found) {
              setParticipants([{
                user: found,
                categoryCode: categoryCode || 'TRAINING',
                selectedLicenseIds: [],
                newLicenses: [],
              }]);
            }
          }).catch(() => {});
        }
      } catch {}
    }
  }, []);

  // Search debounce
  useEffect(() => {
    if (searchQuery.trim().length === 0) { setSearchResults([]); return; }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.searchUsers(searchQuery.trim());
        const excludeIds = [...participants.map((p) => p.user.id), ...(currentUser ? [currentUser.id] : []), ...(myUserId.current ? [myUserId.current] : [])];
        setSearchResults((res.users ?? []).filter((u) => !excludeIds.includes(u.id)));
      } catch {}
      setSearching(false);
    }, 300);
  }, [searchQuery, participants, currentUser]);

  // --- Handlers ---

  const fetchCloseFriends = async () => {
    setFriendsLoading(true);
    try {
      const res = await api.getCloseFriends();
      setCloseFriends(res.friends ?? []);
    } catch {}
    setFriendsLoading(false);
  };

  const handleNextStep = () => {
    if (!title.trim()) { Alert.alert('알림', '제목을 입력해주세요.'); return; }
    if (!categoryCode) { Alert.alert('알림', '분류를 선택해주세요.'); return; }
    setCurrentCategory(categoryCode);
    setStep('participant');
    fetchCloseFriends();
    setTimeout(() => searchInputRef.current?.focus(), 300);
  };

  const handleSelectUser = async (user: UserResult) => {
    setCurrentUser(user);
    setSearchQuery('');
    setSearchResults([]);
    Keyboard.dismiss();
    if (currentCategory === 'CERTIFICATION') {
      fetchLicensesForUser(user.id);
    }
  };

  const handleSelectFriend = async (friend: CloseFriend) => {
    const existingIds = participants.map((p) => p.user.id);
    try {
      const res = await api.searchUsers(friend.nickname);
      const found = (res.users ?? []).find((u) => u.nickname === friend.nickname);
      if (found) {
        if (existingIds.includes(found.id)) return;
        handleSelectUser(found);
      }
    } catch {}
  };

  const handleRemoveCurrentUser = () => {
    setCurrentUser(null);
    setCurrentSelectedLicenseIds([]);
    setCurrentNewLicenses([]);
    setInProgressLicenses([]);
  };

  const handleCurrentCategoryChange = (code: string) => {
    setCurrentCategory(code);
    setCurrentSelectedLicenseIds([]);
    setCurrentNewLicenses([]);
    if (code === 'CERTIFICATION' && currentUser) {
      fetchLicensesForUser(currentUser.id);
    }
  };

  const fetchLicensesForUser = async (userId: number) => {
    setLicensesLoading(true);
    try {
      const res = await api.getInProgressLicenses(userId);
      const licenses = res.licenses ?? [];
      setInProgressLicenses(licenses);
      setCurrentSelectedLicenseIds(licenses.map((l) => l.userLicenseId));
    } catch {}
    setLicensesLoading(false);
  };

  const toggleLicenseId = (id: number) => {
    setCurrentSelectedLicenseIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleAddLicense = async () => {
    if (associations.length === 0) {
      try {
        const res = await api.getAssociations();
        setAssociations(res.associations ?? []);
      } catch {}
    }
    setShowAssociationPicker(true);
  };

  const handleSelectAssociation = async (associationId: number) => {
    if (!currentUser) return;
    try {
      const res = await api.getAvailableLicenses(currentUser.id, associationId);
      const existing = currentNewLicenses.map((l) => l.licenseId);
      setAvailableLicenses((res.licenses ?? []).filter((l) => !existing.includes(l.licenseId)));
      setShowAvailableLicensePicker(true);
    } catch {
      Alert.alert('오류', '자격증 목록을 불러올 수 없습니다.');
    }
  };

  const handleSelectNewLicense = (lic: AvailableLicense) => {
    setCurrentNewLicenses((prev) => [...prev, { licenseId: lic.licenseId, code: lic.code, nameKo: lic.nameKo }]);
  };

  const removeNewLicense = (licenseId: number) => {
    setCurrentNewLicenses((prev) => prev.filter((l) => l.licenseId !== licenseId));
  };

  const addParticipantAndContinue = () => {
    if (!validateCurrentParticipant()) return;
    setParticipants((prev) => [...prev, buildCurrentEntry()!]);
    resetCurrentParticipant();
    setTimeout(() => searchInputRef.current?.focus(), 200);
  };

  const removeParticipant = (index: number) => {
    setParticipants((prev) => prev.filter((_, i) => i !== index));
  };

  const validateCurrentParticipant = () => {
    if (!currentUser) return false;
    if (!currentCategory) { Alert.alert('알림', '분류를 선택해주세요.'); return false; }
    if (currentCategory === 'CERTIFICATION' && currentSelectedLicenseIds.length === 0 && currentNewLicenses.length === 0) {
      Alert.alert('알림', '자격증 과정을 하나 이상 선택해주세요.');
      return false;
    }
    return true;
  };

  const buildCurrentEntry = (): ParticipantEntry | null => {
    if (!currentUser) return null;
    return {
      user: currentUser,
      categoryCode: currentCategory,
      selectedLicenseIds: currentCategory === 'CERTIFICATION' ? currentSelectedLicenseIds : [],
      newLicenses: currentCategory === 'CERTIFICATION' ? currentNewLicenses : [],
    };
  };

  const resetCurrentParticipant = () => {
    setCurrentUser(null);
    setCurrentCategory(categoryCode);
    setCurrentSelectedLicenseIds([]);
    setCurrentNewLicenses([]);
    setInProgressLicenses([]);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleSave = () => {
    const allParticipants = [...participants];
    if (currentUser) {
      if (!validateCurrentParticipant()) return;
      allParticipants.push(buildCurrentEntry()!);
    }

    const dateStr = `${dateObj.getFullYear()}년 ${month}월 ${day}일 ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    const catLabel = getCategoryLabel(categoryCode);
    const participantSummary = allParticipants.length > 0
      ? allParticipants.map((p) => `  - ${p.user.nickname} (${getCategoryLabel(p.categoryCode)})`).join('\n')
      : '  없음';

    Alert.alert(
      isEditMode ? '다이빙을 수정하시겠어요?' : '다이빙을 등록하시겠어요?',
      `${title.trim()}\n${dateStr}\n${catLabel}${selectedPool ? ` · ${selectedPool.name}` : ''}\n\n${participantLabel} ${allParticipants.length}명\n${participantSummary}`,
      [
        { text: '취소', style: 'cancel' },
        { text: isEditMode ? '수정할게요' : '등록할게요', onPress: () => doSave(allParticipants) },
      ],
    );
  };

  const doSave = async (allParticipants: ParticipantEntry[]) => {
    const payload = {
      title: title.trim(),
      scheduleDate,
      startHour: hour,
      startMinute: minute,
      poolId: selectedPool?.id ?? null,
      categoryCode,
      visibility,
      participants: allParticipants.map((p) => ({
        userId: p.user.id,
        categoryCode: p.categoryCode,
        ...(p.categoryCode === 'CERTIFICATION' ? {
          userLicenseIds: p.selectedLicenseIds,
          newLicenses: p.newLicenses.map((l) => l.licenseId),
        } : {}),
      })),
    };

    try {
      setSaving(true);
      if (isEditMode) {
        await api.updateSchedule(Number(id), payload);
        router.back();
      } else {
        const res = await api.createSchedule(payload);
        router.back();
        setTimeout(() => {
          router.push({ pathname: '/schedule-detail', params: { id: String(res.scheduleId) } });
        }, 100);
      }
    } catch (e: any) {
      setSaving(false);
      if (!e._handled) Alert.alert(isEditMode ? '수정 실패' : '등록 실패', e.message ?? '잠시 후 다시 시도해주세요.');
    }
  };

  const maskPhone = (p?: string) => {
    if (!p) return '';
    const d = p.replace(/\D/g, '');
    if (d.length === 11) return `${d.slice(0, 3)}-****-${d.slice(7)}`;
    if (d.length === 10) return `${d.slice(0, 3)}-***-${d.slice(6)}`;
    return p;
  };

  const getCategoryLabel = (code: string) => CATEGORIES.find((c) => c.code === code)?.label ?? code;

  const handleBack = () => {
    router.back();
  };

  // --- Render ---

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />

      {loadingDetail ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Spinner /></View>
      ) : (
      <>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}
        >
          <View style={styles.backCircle}>
            <Text style={styles.backArrow}>{'<'}</Text>
          </View>
        </Pressable>
        <Text style={styles.headerTitle}>
          {step === 'info' ? (isEditMode ? '일정 수정' : '다이빙 만들기') : participantLabel}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        {/* === Step 1: Info === */}
        {step === 'info' && (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
            <Text style={styles.label}>제목</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="일정 제목을 입력해주세요"
              placeholderTextColor="rgba(255,255,255,0.25)"
            />

            <Text style={styles.label}>장소</Text>
            <Pressable style={styles.pickerButton} onPress={() => { Keyboard.dismiss(); setShowPoolPicker(true); }}>
              <Text style={[styles.pickerText, !selectedPool && styles.pickerPlaceholder]}>
                {selectedPool?.name ?? '장소를 선택해주세요'}
              </Text>
              <Text style={styles.pickerArrow}>▼</Text>
            </Pressable>

            {!isEditMode && (
              <>
                <Text style={styles.label}>날짜</Text>
                <Pressable style={styles.dateInputRow} onPress={() => { Keyboard.dismiss(); setShowDatePicker(true); }}>
                  <Text style={styles.pickerText}>{dateObj.getFullYear()}년 {month}월 {day}일</Text>
                  <Text style={styles.calendarIcon}>📅</Text>
                </Pressable>
              </>
            )}

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

            <Text style={styles.label}>분류</Text>
            <Pressable style={styles.pickerButton} onPress={() => { Keyboard.dismiss(); setShowCategoryPicker(true); }}>
              <Text style={[styles.pickerText, !selectedCategory && styles.pickerPlaceholder]}>
                {selectedCategory?.label ?? '분류를 선택해주세요'}
              </Text>
              <Text style={styles.pickerArrow}>▼</Text>
            </Pressable>

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
                style={Platform.OS === 'android' ? { transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }], marginVertical: -10 } : undefined}
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
          </ScrollView>
        )}

        {/* === Step 2: Participant === */}
        {step === 'participant' && (
          <ScrollView ref={participantScrollRef} style={{ flex: 1 }} contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">

            {/* Already added participants */}
            {participants.length > 0 && (
              <View style={styles.addedSection}>
                {participants.map((p, i) => (
                  <View key={`${p.user.id}_${i}`} style={styles.addedCard}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.addedNameRow}>
                        <Text style={styles.addedName}>{p.user.nickname}{p.user.name ? ` (${p.user.name})` : ''}</Text>
                        <LevelBadge level={p.user.level} size={18} />
                      </View>
                      <Text style={styles.addedCategory}>{getCategoryLabel(p.categoryCode)}</Text>
                    </View>
                    <Pressable onPress={() => removeParticipant(i)} style={styles.addedRemove}>
                      <Text style={styles.addedRemoveText}>✕</Text>
                    </Pressable>
                  </View>
                ))}
                <View style={styles.addedDivider} />
              </View>
            )}

            {/* Prompt */}
            <Text style={styles.promptText}>
              {participants.length === 0 ? '첫번째' : `${participants.length + 1}번째`} {participantLabel}을 입력해주세요
            </Text>

            {!currentUser ? (
              <>
                {/* Tabs */}
                <View style={styles.tabRow}>
                  <Pressable
                    style={[styles.tabItem, participantTab === 'search' && styles.tabItemActive]}
                    onPress={() => setParticipantTab('search')}
                  >
                    <Text style={[styles.tabText, participantTab === 'search' && styles.tabTextActive]}>사용자 검색</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.tabItem, participantTab === 'friends' && styles.tabItemActive]}
                    onPress={() => setParticipantTab('friends')}
                  >
                    <Text style={[styles.tabText, participantTab === 'friends' && styles.tabTextActive]}>친한친구</Text>
                  </Pressable>
                </View>

                {participantTab === 'search' ? (
                  <>
                    <View onLayout={(e) => { searchInputLayoutY.current = e.nativeEvent.layout.y; }}>
                      <TextInput
                        ref={searchInputRef}
                        style={styles.input}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="이름, 전화번호로 검색"
                        placeholderTextColor="rgba(255,255,255,0.25)"
                        onFocus={() => {
                          setTimeout(() => {
                            participantScrollRef.current?.scrollTo({ y: searchInputLayoutY.current - 16, animated: true });
                          }, 300);
                        }}
                      />
                    </View>
                    {searching && (
                      <View style={styles.searchLoading}>
                        <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" />
                      </View>
                    )}
                    {searchResults.length > 0 && (
                      <View style={styles.searchResults}>
                        {searchResults.map((user) => (
                          <Pressable
                            key={user.id}
                            style={({ pressed }) => [styles.searchItem, pressed && { opacity: 0.6 }]}
                            onPress={() => handleSelectUser(user)}
                          >
                            <View style={{ flex: 1 }}>
                              <View style={styles.searchNameRow}>
                                <Text style={styles.searchName}>{user.nickname}{user.name ? ` (${user.name})` : ''}</Text>
                                <LevelBadge level={user.level} size={18} />
                              </View>
                              {user.phone ? <Text style={styles.searchSub}>{maskPhone(user.phone)}</Text> : null}
                            </View>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </>
                ) : (
                  <>
                    {friendsLoading ? (
                      <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                        <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" />
                      </View>
                    ) : closeFriends.length === 0 ? (
                      <Text style={styles.emptyText}>친한친구가 없습니다.</Text>
                    ) : (
                      closeFriends
                        .filter((f) => !participants.some((p) => p.user.nickname === f.nickname) && currentUser?.nickname !== f.nickname)
                        .map((friend) => (
                          <Pressable
                            key={friend.userId}
                            style={({ pressed }) => [styles.searchItem, pressed && { opacity: 0.6 }]}
                            onPress={() => handleSelectFriend(friend)}
                          >
                            <View style={{ flex: 1 }}>
                              <View style={styles.searchNameRow}>
                                <Text style={styles.searchName}>{friend.nickname}{friend.name ? ` (${friend.name})` : ''}</Text>
                                <LevelBadge level={friend.level} size={18} />
                              </View>
                            </View>
                          </Pressable>
                        ))
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                {/* Selected user card */}
                <View style={styles.selectedCard}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.searchNameRow}>
                      <Text style={styles.searchName}>{currentUser.nickname}{currentUser.name ? ` (${currentUser.name})` : ''}</Text>
                      <LevelBadge level={currentUser.level} size={18} />
                    </View>
                    {currentUser.phone ? <Text style={styles.searchSub}>{maskPhone(currentUser.phone)}</Text> : null}
                  </View>
                  <Pressable onPress={handleRemoveCurrentUser} style={styles.addedRemove}>
                    <Text style={styles.addedRemoveText}>✕</Text>
                  </Pressable>
                </View>

                {/* Category picker for this participant */}
                <Text style={styles.label}>다이빙 구분</Text>
                <Pressable style={styles.pickerButton} onPress={() => { Keyboard.dismiss(); setShowParticipantCategoryPicker(true); }}>
                  <Text style={styles.pickerText}>{participantCategoryLabel || '분류를 선택해주세요'}</Text>
                  <Text style={styles.pickerArrow}>▼</Text>
                </Pressable>

                {/* License section for CERTIFICATION */}
                {currentCategory === 'CERTIFICATION' && (
                  <View style={styles.licenseSection}>
                    <Text style={styles.label}>자격증 과정</Text>

                    {licensesLoading ? (
                      <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                        <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" />
                      </View>
                    ) : (
                      <>
                        {inProgressLicenses.length === 0 && currentNewLicenses.length === 0 && (
                          <Text style={styles.emptyText}>
                            진행중인 자격증 과정이 없습니다.{'\n'}아래 버튼으로 자격증 과정을 추가해주세요.
                          </Text>
                        )}

                        {/* In-progress licenses */}
                        {inProgressLicenses.map((lic) => {
                          const selected = currentSelectedLicenseIds.includes(lic.userLicenseId);
                          return (
                            <Pressable
                              key={lic.userLicenseId}
                              style={[styles.licenseItem, selected && styles.licenseItemSelected]}
                              onPress={() => toggleLicenseId(lic.userLicenseId)}
                            >
                              <View style={[styles.checkbox, selected && styles.checkboxChecked]}>
                                {selected && <Text style={styles.checkmark}>✓</Text>}
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.licenseName}>{lic.nameKo}</Text>
                                <Text style={styles.licenseAssoc}>{lic.associationName}</Text>
                              </View>
                            </Pressable>
                          );
                        })}

                        {/* Newly added licenses */}
                        {currentNewLicenses.map((lic) => (
                          <View key={lic.licenseId} style={[styles.licenseItem, styles.licenseItemSelected]}>
                            <View style={[styles.checkbox, styles.checkboxChecked, styles.checkboxNew]}>
                              <Text style={styles.checkmark}>+</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.licenseName}>{lic.nameKo}</Text>
                              <Text style={styles.licenseNew}>신규 등록</Text>
                            </View>
                            <Pressable onPress={() => removeNewLicense(lic.licenseId)} style={styles.addedRemove}>
                              <Text style={styles.addedRemoveText}>✕</Text>
                            </Pressable>
                          </View>
                        ))}

                        {/* Add license button */}
                        <Pressable
                          style={({ pressed }) => [styles.addLicenseButton, pressed && { opacity: 0.7 }]}
                          onPress={handleAddLicense}
                        >
                          <Text style={styles.addLicenseText}>+ 자격증 과정 추가</Text>
                        </Pressable>
                      </>
                    )}
                  </View>
                )}
              </>
            )}

          </ScrollView>
        )}

        {/* Bottom buttons - always fixed, KeyboardAvoidingView pushes above keyboard */}
        <View style={styles.bottomArea}>
          {step === 'info' ? (
            <Pressable
              style={({ pressed }) => [styles.primaryButton, pressed && { opacity: 0.85 }]}
              onPress={handleNextStep}
            >
              <Text style={styles.primaryButtonText}>다음</Text>
            </Pressable>
          ) : (
            <View style={styles.bottomRow}>
              {currentUser && (
                <Pressable
                  style={({ pressed }) => [styles.secondaryButton, pressed && { opacity: 0.85 }]}
                  onPress={addParticipantAndContinue}
                >
                  <Text style={styles.secondaryButtonText}>{participantLabel} 추가</Text>
                </Pressable>
              )}
              <Pressable
                style={({ pressed }) => [styles.primaryButton, { flex: 1 }, pressed && { opacity: 0.85 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={Colors.brand.primary} />
                ) : (
                  <Text style={styles.primaryButtonText}>{isEditMode ? '수정' : '저장'}</Text>
                )}
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

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
        onSelect={(v) => setSelectedPool(v)} selectedValue={selectedPool} searchable
      />
      <BottomSheet
        visible={showHourPicker} onClose={() => setShowHourPicker(false)} title="시"
        items={HOURS.map((h) => ({ label: `${String(h).padStart(2, '0')}시`, value: h }))}
        onSelect={(v) => setHour(v)} selectedValue={hour}
      />
      <BottomSheet
        visible={showMinutePicker} onClose={() => setShowMinutePicker(false)} title="분"
        items={MINUTES.map((m) => ({ label: `${String(m).padStart(2, '0')}분`, value: m }))}
        onSelect={(v) => setMinute(v)} selectedValue={minute}
      />
      <BottomSheet
        visible={showCategoryPicker} onClose={() => setShowCategoryPicker(false)} title="분류 선택"
        items={CATEGORIES.map((c) => ({ label: c.label, value: c.code }))}
        onSelect={(v) => setCategoryCode(v)} selectedValue={categoryCode}
      />
      <BottomSheet
        visible={showParticipantCategoryPicker} onClose={() => setShowParticipantCategoryPicker(false)} title="다이빙 구분"
        items={CATEGORIES.map((c) => ({ label: c.label, value: c.code }))}
        onSelect={(v) => handleCurrentCategoryChange(v)} selectedValue={currentCategory}
      />
      <BottomSheet
        visible={showAssociationPicker} onClose={() => setShowAssociationPicker(false)} title="협회 선택"
        items={associations.map((a) => ({ label: a.name, value: a.id }))}
        onSelect={(v) => handleSelectAssociation(v)}
      />
      <BottomSheet
        visible={showAvailableLicensePicker} onClose={() => setShowAvailableLicensePicker(false)} title="자격증 선택"
        items={availableLicenses.map((l) => ({ label: l.nameKo, value: l }))}
        onSelect={(v) => handleSelectNewLicense(v)}
      />
      </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.brand.primary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    height: 52, paddingHorizontal: 20,
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
  calendarIcon: { fontSize: 18 },
  pickerButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  pickerText: { fontFamily: 'SUIT-Regular', fontSize: 16, color: Colors.brand.white },
  pickerPlaceholder: { color: 'rgba(255,255,255,0.25)' },
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
    paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  visibilityText: { fontFamily: 'SUIT-SemiBold', fontSize: 15, color: Colors.brand.white },
  visibilityDesc: {
    fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.35)',
    marginTop: 6, paddingHorizontal: 4,
  },

  // Participant step
  promptText: {
    fontFamily: 'SUIT-SemiBold', fontSize: 16, color: Colors.brand.white,
    marginBottom: 16,
  },
  tabRow: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10, marginBottom: 14,
  },
  tabItem: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabItemActive: { backgroundColor: 'rgba(255,255,255,0.15)' },
  tabText: { fontFamily: 'SUIT-SemiBold', fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  tabTextActive: { color: Colors.brand.white },
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
  searchNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  searchName: { fontFamily: 'SUIT-SemiBold', fontSize: 15, color: Colors.brand.white },
  searchSub: { fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  emptyText: {
    fontFamily: 'SUIT-Regular', fontSize: 14, color: 'rgba(255,255,255,0.3)',
    textAlign: 'center', paddingVertical: 16,
  },

  // Selected user
  selectedCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: 'rgba(52,199,89,0.3)',
  },

  // Added participants
  addedSection: { marginBottom: 8 },
  addedCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 6,
  },
  addedNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addedName: { fontFamily: 'SUIT-SemiBold', fontSize: 14, color: Colors.brand.white },
  addedCategory: { fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  addedRemove: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  addedRemoveText: { fontSize: 14, color: 'rgba(255,255,255,0.5)' },
  addedDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 8, marginBottom: 8 },

  // License section
  licenseSection: { marginTop: 4 },
  licenseItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 6,
  },
  licenseItemSelected: {
    backgroundColor: 'rgba(52,199,89,0.08)',
    borderWidth: 1, borderColor: 'rgba(52,199,89,0.2)',
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.brand.success, borderColor: Colors.brand.success,
  },
  checkboxNew: {
    backgroundColor: Colors.brand.warning, borderColor: Colors.brand.warning,
  },
  checkmark: { fontFamily: 'SUIT-Bold', fontSize: 13, color: Colors.brand.white },
  licenseName: { fontFamily: 'SUIT-SemiBold', fontSize: 14, color: Colors.brand.white },
  licenseAssoc: { fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 1 },
  licenseNew: { fontFamily: 'SUIT-Regular', fontSize: 12, color: Colors.brand.warning, marginTop: 1 },
  addLicenseButton: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center', marginTop: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderStyle: 'dashed',
  },
  addLicenseText: {
    fontFamily: 'SUIT-SemiBold', fontSize: 13, color: 'rgba(255,255,255,0.5)',
  },

  // Bottom
  bottomArea: { paddingHorizontal: 24, paddingVertical: 12 },
  bottomRow: { flexDirection: 'row', gap: 10 },
  primaryButton: {
    height: 54, borderRadius: 14, backgroundColor: Colors.brand.white,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryButtonText: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.primary },
  secondaryButton: {
    height: 54, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20,
  },
  secondaryButtonText: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.white },
});
