import { useAuth } from '@/contexts/AuthContext';
import { hasInstructorAccess } from '@/utils/userRole';
import { maskPhone } from '@/utils/format';
import { useState, useEffect, useRef } from 'react';
import { TextInput, ScrollView, Alert, Keyboard } from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useUserSearch } from '@/hooks/useSearch';
import { useLatestRequest } from '@/hooks/useLatestRequest';
import { api, InProgressLicense, AvailableLicense, Association } from '@/services/api';

import { CloseFriend } from '@/services/api';

export const CATEGORIES = [
  { code: 'EXPERIENCE', label: '체험교육' },
  { code: 'CERTIFICATION', label: '자격증 과정' },
  { code: 'LECTURE', label: '특강' },
  { code: 'TRAINING', label: '트레이닝' },
  { code: 'FUN_DIVE', label: '펀다이빙' },
  { code: 'ETC', label: '기타' },
];
export const STUDENT_CATEGORIES = ['EXPERIENCE', 'CERTIFICATION', 'LECTURE'];
export const HOURS = Array.from({ length: 24 }, (_, i) => i);
export const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
export type Pool = { id: number; name: string };
export type UserResult = { id: number; userId?: string | null; nickname: string; profileImage?: string | null; name?: string; phone: string; birthDate?: string; level?: string | number | null; isGuest?: boolean; isTemporary?: boolean };
export type ParticipantEntry = {
  user: UserResult;
  categoryCode: string;
  selectedLicenseIds: number[];
  newLicenses: { licenseId: number; code: string; nameKo: string }[];
};
export type Step = 'info' | 'participant';

export function useScheduleEditor() {
  const { user } = useAuth();
  const categories = CATEGORIES.filter(c => hasInstructorAccess(user?.level) || !STUDENT_CATEGORIES.includes(c.code));
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
  const newParticipantLayout = useRef<{ y: number; height: number } | null>(null);
  const keepParticipantVisibleRef = useRef(false);
  const [participantRevealed, setParticipantRevealed] = useState(false);
  const [participantViewportHeight, setParticipantViewportHeight] = useState(0);
  const [participantSectionHeight, setParticipantSectionHeight] = useState(0);

  const scrollParticipantIntoView = () => {
    if (!keepParticipantVisibleRef.current || !newParticipantLayout.current) return;
    participantScrollRef.current?.scrollTo({ y: Math.max(0, newParticipantLayout.current.y - 16), animated: true });
  };
  const revealParticipant = () => {
    keepParticipantVisibleRef.current = true;
    setParticipantRevealed(true);
    scrollParticipantIntoView();
  };
  const handleParticipantScrollBeginDrag = () => {
    // Let the user browse a long list without layout/keyboard events pulling it back.
    keepParticipantVisibleRef.current = false;
  };
  const handleNewParticipantLayout = (event: { nativeEvent: { layout: { y: number; height: number } } }) => {
    newParticipantLayout.current = event.nativeEvent.layout;
    setParticipantSectionHeight(event.nativeEvent.layout.height);
    scrollParticipantIntoView();
  };
  const handleParticipantLayout = (event: { nativeEvent: { layout: { height: number } } }) => {
    setParticipantViewportHeight(event.nativeEvent.layout.height);
    scrollParticipantIntoView();
  };
  // Keep enough scroll range to reveal the whole card, including its heading and tabs.
  const participantBottomPadding = participantRevealed
    ? Math.max(40, participantViewportHeight - participantSectionHeight - 16) : 40;

  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', scrollParticipantIntoView);
    const hidden = Keyboard.addListener('keyboardDidHide', scrollParticipantIntoView);
    return () => { shown.remove(); hidden.remove(); };
  }, []);

  const [showTemporaryModal, setShowTemporaryModal] = useState(false);
  const [temporaryCategory, setTemporaryCategory] = useState('');
  const [temporaryName, setTemporaryName] = useState('');
  const [creatingTemporary, setCreatingTemporary] = useState(false);
  const creatingTemporaryRef = useRef(false);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const { results: foundUsers, searching, error: searchError, completedQuery } = useUserSearch(searchQuery, !currentUser && step === 'participant');
  const licensesRequest = useLatestRequest();
  const availableRequest = useLatestRequest();
  const selectionRequest = useLatestRequest();
  const closeFriendsRequest = useLatestRequest();
  const temporaryRequest = useLatestRequest();
  const searchInputRef = useRef<TextInput>(null);
  const [participantTab, setParticipantTab] = useState<'search' | 'friends'>('search');
  const [closeFriends, setCloseFriends] = useState<CloseFriend[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);

  const handleParticipantTabChange = (tab: 'search' | 'friends') => {
    setParticipantTab(tab);
    if (tab === 'friends') Keyboard.dismiss();
    revealParticipant();
  };
  const handleSearchSubmit = () => {
    searchInputRef.current?.blur();
    Keyboard.dismiss();
    revealParticipant();
  };
  useEffect(() => {
    if (step === 'participant' && participantTab === 'search' && !currentUser && !searching
      && (searchError || (!!completedQuery && completedQuery === searchQuery.trim()))) {
      revealParticipant();
    }
  }, [step, participantTab, currentUser, searching, completedQuery, searchQuery, searchError]);


  // License addition
  const [associations, setAssociations] = useState<Association[]>([]);
  const [showAssociationPicker, setShowAssociationPicker] = useState(false);
  const [availableLicensesLoading, setAvailableLicensesLoading] = useState(false);
  const [availableLicenses, setAvailableLicenses] = useState<AvailableLicense[]>([]);
  const [showAvailableLicensePicker, setShowAvailableLicensePicker] = useState(false);

  // Pickers
  const [showPoolPicker, setShowPoolPicker] = useState(false);
  const [showHourPicker, setShowHourPicker] = useState(false);
  const [showMinutePicker, setShowMinutePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Other
  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(isEditMode);
  const myUserId = useRef<number | null>(null);

  const isStudentType = STUDENT_CATEGORIES.includes(categoryCode);
  const participantLabel = isStudentType ? '교육생' : '참석자';

  const [savedDestination, setSavedDestination] = useState<{ scheduleId?: number } | null>(null);
  const leavePromptVisible = useRef(false);
  const hasUnsavedInput = !isEditMode && (title.trim() !== '' || selectedPool !== null || categoryCode !== '' || participants.length > 0 || currentUser !== null);

  usePreventRemove(!savedDestination && (saving || step === 'participant' || hasUnsavedInput), ({ data }) => {
    if (saving) return;
    if (step === 'participant') {
      setStep('info');
      return;
    }
    if (leavePromptVisible.current) return;
    leavePromptVisible.current = true;
    const dismiss = () => { leavePromptVisible.current = false; };
    Alert.alert(
      '확인',
      '등록된 다이빙 일정 정보가 사라집니다.\n취소하시겠어요?',
      [
        { text: '아니오', style: 'cancel', onPress: dismiss },
        { text: '예', style: 'destructive', onPress: () => { dismiss(); navigation.dispatch(data.action); } },
      ],
      { cancelable: true, onDismiss: dismiss },
    );
  });

  // Navigate only after the successful-save render releases native removal prevention.
  useEffect(() => {
    if (!savedDestination) return;
    router.back();
    if (savedDestination.scheduleId !== undefined) {
      const scheduleId = savedDestination.scheduleId;
      setTimeout(() => router.push({ pathname: '/schedule-detail', params: { id: String(scheduleId) } }), 100);
    }
  }, [savedDestination, router]);

  // --- Effects ---

  useEffect(() => {
    let active = true;
    api.getProfile()
      .then((res) => { if (active) myUserId.current = res.user.id; })
      .catch(() => {});

    if (!isEditMode) {
      api.getUserSettings()
        .then((res) => { if (active) setVisibility(res.settings.schedulePublic === 'Y' ? 'public' : 'private'); })
        .catch(() => {});
    }

    api.getDivingPools()
      .then((res) => {
        if (!active) return;
        const sortedPools = (res.pools ?? []).sort((a, b) => a.id - b.id);
        setPools(sortedPools);

        if (isEditMode) {
          setLoadingDetail(true);
          api.getScheduleDetail(Number(id)).then((res) => {
            if (!active) return;
            const s = res.schedule;
            setTitle(s.title);
            setScheduleDate(s.scheduleDate);
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
                user: { id: p.id, userId: p.userId, nickname: p.nickname, profileImage: p.profileImage, name: p.name, phone: '', level: p.level, isGuest: p.isGuest, isTemporary: p.isTemporary },
                categoryCode: p.categoryCode || s.categoryCode,
                selectedLicenseIds: (p.participantLicenses || []).map((l) => l.userLicenseId),
                newLicenses: [],
              }))
            );
          }).catch(() => { if (active) Alert.alert('오류', '일정을 불러오지 못했습니다.'); }).finally(() => { if (active) setLoadingDetail(false); });
        }
      })
      .catch(() => {
        if (active) {
          setLoadingDetail(false);
          Alert.alert('오류', '일정 정보를 불러오지 못했습니다.');
        }
      });

    if (prefillParticipant) {
      try {
        const p = JSON.parse(prefillParticipant);
        if (p.nickname) {
          api.searchUsers(p.nickname).then((res) => {
            if (!active) return;
            const found = (res.users ?? []).find((u: any) =>
              (p.userId && u.userId === p.userId) || (p.id > 0 && u.id === p.id)
            );
            if (found) {
              setParticipants((prev) => prev.length ? prev : [{
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
    return () => { active = false; };
  }, [id, prefillParticipant]);

  const excludeIds = [...participants.map((p) => p.user.id), ...(currentUser ? [currentUser.id] : []), ...(myUserId.current ? [myUserId.current] : [])];
  const searchResults = foundUsers.filter((u) => !excludeIds.includes(u.id));

  // --- Handlers ---

  const fetchCloseFriends = async () => {
    const isCurrent = closeFriendsRequest.start();
    setFriendsLoading(true);
    try {
      const res = await api.getCloseFriends();
      if (isCurrent()) setCloseFriends(res.friends ?? []);
    } catch {}
    if (isCurrent()) setFriendsLoading(false);
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
    selectionRequest.invalidate();
    licensesRequest.invalidate();
    availableRequest.invalidate();
    setAvailableLicensesLoading(false);
    setCurrentUser(user);
    setSearchQuery('');
    Keyboard.dismiss();
    if (currentCategory === 'CERTIFICATION') {
      fetchLicensesForUser(user.id);
    }
  };

  const canRegisterTemporary = !!searchQuery.trim() && completedQuery === searchQuery.trim()
    && !searching && !searchError && foundUsers.length === 0;

  const openTemporaryModal = () => {
    if (!canRegisterTemporary) return;
    Keyboard.dismiss();
    setTemporaryName(searchQuery.trim());
    setTemporaryCategory(categoryCode);
    setShowTemporaryModal(true);
  };

  const closeTemporaryModal = () => {
    if (!creatingTemporaryRef.current) setShowTemporaryModal(false);
  };

  const handleCreateTemporary = async () => {
    if (creatingTemporaryRef.current) return;
    const name = temporaryName.trim();
    if (!name || name.length > 50) {
      Alert.alert('이름 확인', '이름을 1~50자로 입력해주세요.');
      return;
    }
    if (!categories.some(c => c.code === temporaryCategory)) {
      Alert.alert('분류 확인', '일정 분류를 선택해주세요.');
      return;
    }
    const isCurrent = temporaryRequest.start();
    creatingTemporaryRef.current = true;
    setCreatingTemporary(true);
    try {
      const result = await api.createTemporaryUser(name);
      if (!isCurrent()) return;
      setParticipants(prev => [...prev, {
        user: result.user, categoryCode: temporaryCategory, selectedLicenseIds: [], newLicenses: [],
      }]);
      resetCurrentParticipant();
      setShowTemporaryModal(false);
      setTemporaryName('');
      setParticipantTab('search');
      setTimeout(() => searchInputRef.current?.focus(), 250);
    } catch (error: any) {
      if (isCurrent()) Alert.alert('등록 실패', error.message || '임시 사용자를 등록하지 못했습니다.');
    } finally {
      creatingTemporaryRef.current = false;
      setCreatingTemporary(false);
    }
  };

  const handleSelectFriend = async (friend: CloseFriend) => {
    const isCurrent = selectionRequest.start();
    const existingIds = participants.map((p) => p.user.id);
    try {
      const res = await api.searchUsers(friend.nickname);
      const found = (res.users ?? []).find((u) => u.userId === friend.userId);
      if (found && isCurrent()) {
        if (existingIds.includes(found.id)) return;
        handleSelectUser(found);
      }
    } catch {}
  };

  const handleRemoveCurrentUser = () => {
    selectionRequest.invalidate();
    licensesRequest.invalidate();
    availableRequest.invalidate();
    setAvailableLicensesLoading(false);
    setLicensesLoading(false);
    setShowAssociationPicker(false);
    setShowAvailableLicensePicker(false);
    setCurrentUser(null);
    setCurrentSelectedLicenseIds([]);
    setCurrentNewLicenses([]);
    setInProgressLicenses([]);
  };

  const closeLicensePicker = () => {
    availableRequest.invalidate();
    setAvailableLicensesLoading(false);
    setShowAssociationPicker(false);
    setShowAvailableLicensePicker(false);
  };

  const handleCurrentCategoryChange = (code: string) => {
    licensesRequest.invalidate();
    availableRequest.invalidate();
    setAvailableLicensesLoading(false);
    setLicensesLoading(false);
    setShowAvailableLicensePicker(false);
    setShowAssociationPicker(false);
    setCurrentCategory(code);
    setCurrentSelectedLicenseIds([]);
    setCurrentNewLicenses([]);
    if (code === 'CERTIFICATION' && currentUser) {
      fetchLicensesForUser(currentUser.id);
    }
  };

  const fetchLicensesForUser = async (userId: number) => {
    const isCurrent = licensesRequest.start();
    setLicensesLoading(true);
    try {
      const res = await api.getInProgressLicenses(userId);
      if (!isCurrent()) return;
      const licenses = res.licenses ?? [];
      setInProgressLicenses(licenses);
      setCurrentSelectedLicenseIds(licenses.map((l) => l.userLicenseId));
    } catch {}
    if (isCurrent()) setLicensesLoading(false);
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
    setShowAvailableLicensePicker(false);
    setShowAssociationPicker(true);
  };

  const handleSelectAssociation = async (associationId: number) => {
    if (!currentUser) return;
    const isCurrent = availableRequest.start();
    setAvailableLicensesLoading(true);
    try {
      const res = await api.getAvailableLicenses(currentUser.id, associationId);
      if (!isCurrent()) return;
      const existing = currentNewLicenses.map((l) => l.licenseId);
      setAvailableLicenses((res.licenses ?? []).filter((l) => !existing.includes(l.licenseId)));
      setShowAssociationPicker(false);
      setShowAvailableLicensePicker(true);
    } catch {
      if (isCurrent()) Alert.alert('오류', '자격증 목록을 불러올 수 없습니다.');
    } finally {
      if (isCurrent()) setAvailableLicensesLoading(false);
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
    selectionRequest.invalidate();
    licensesRequest.invalidate();
    availableRequest.invalidate();
    setAvailableLicensesLoading(false);
    setLicensesLoading(false);
    setShowAssociationPicker(false);
    setShowAvailableLicensePicker(false);
    setCurrentUser(null);
    setCurrentCategory(categoryCode);
    setCurrentSelectedLicenseIds([]);
    setCurrentNewLicenses([]);
    setInProgressLicenses([]);
    setSearchQuery('');
  };

  const handleSave = () => {
    if (creatingTemporaryRef.current) return;
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
        setSavedDestination({});
      } else {
        const res = await api.createSchedule(payload);
        setSavedDestination({ scheduleId: res.scheduleId });
      }
    } catch (e: any) {
      setSaving(false);
      if (!e._handled) Alert.alert(isEditMode ? '수정 실패' : '등록 실패', e.message ?? '잠시 후 다시 시도해주세요.');
    }
  };

  const getCategoryLabel = (code: string) => CATEGORIES.find((c) => c.code === code)?.label ?? code;

  const handleBack = () => {
    router.back();
  };

  // --- Render ---

  return {
    categories, insets, id, isEditMode, step,
    scheduleDate, setScheduleDate, dateObj, month,
    day, title, setTitle, selectedPool,
    setSelectedPool, pools, hour, setHour,
    minute, setMinute, categoryCode, setCategoryCode,
    visibility, setVisibility, participants, currentUser,
    currentCategory, currentSelectedLicenseIds, currentNewLicenses, inProgressLicenses,
    licensesLoading, participantScrollRef, searchQuery,
    participantBottomPadding, handleParticipantLayout, handleNewParticipantLayout,
    handleSearchFocus: revealParticipant, handleSearchSubmit, scrollParticipantIntoView, handleParticipantScrollBeginDrag,
    setSearchQuery, searching, searchError, searchInputRef,
    canRegisterTemporary, showTemporaryModal, openTemporaryModal, closeTemporaryModal,
    temporaryCategory, setTemporaryCategory, temporaryName, setTemporaryName, creatingTemporary, handleCreateTemporary,
    participantTab, handleParticipantTabChange, closeFriends, friendsLoading,
    associations, showAssociationPicker, setShowAssociationPicker, availableLicenses, availableLicensesLoading, closeLicensePicker,
    showAvailableLicensePicker, setShowAvailableLicensePicker, showPoolPicker, setShowPoolPicker,
    showHourPicker, setShowHourPicker, showMinutePicker, setShowMinutePicker,
    showDatePicker, setShowDatePicker,
    saving, loadingDetail,
    participantLabel, searchResults,
    handleNextStep, handleSelectUser, handleSelectFriend, handleRemoveCurrentUser,
    handleCurrentCategoryChange, toggleLicenseId, handleAddLicense, handleSelectAssociation,
    handleSelectNewLicense, removeNewLicense, addParticipantAndContinue, removeParticipant,
    handleSave, maskPhone, getCategoryLabel, handleBack,
  };
}
