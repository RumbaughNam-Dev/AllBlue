import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { api, MyTour, TourSort } from '@/services/api';
import BottomSheet from '@/components/BottomSheet';
import GlassChip from '@/components/GlassChip';
import GlassCircle from '@/components/GlassCircle';
import StripBackSlot from '@/components/StripBackSlot';
import { useAppRouter, useIsPaneRoot } from '@/features/split/SplitPane';
import { useLatestRequest } from '@/hooks/useLatestRequest';
import { StatusBadge, TourEmpty, TourRow } from './TourCards';
import { OverCapacityPopup, TourProcessPopup } from './TourManagePopups';
import { SORT_LABELS } from './TourSearchScreen';
import { localToday } from './tourForm';
import { manageActions, manageNotice, wishNotice } from './manage';
import { editNotice } from './edit';
import { formatFee, formatTourPeriod } from './ui';

const SIDE = 20;
const SORTS: TourSort[] = ['START_ASC', 'START_DESC', 'DEADLINE', 'CAPACITY_ASC', 'CAPACITY_DESC'];
type Tab = 'ongoing' | 'past';
type Toast = { tourId: number; text: string; undo: { recruitedCount: number; capacity: number; status: MyTour['status'] } };

// 8~10장 투어 관리: 내가 만든 투어를 큰 카드로 보고 바로 처리 (admin도 남의 투어는 못 고침)
export default function TourManageScreen() {
  const router = useAppRouter();
  const isPaneRoot = useIsPaneRoot();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('ongoing');
  const [sort, setSort] = useState<TourSort>('START_ASC');
  const [view, setView] = useState<'card' | 'list'>('card');
  const [tours, setTours] = useState<MyTour[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [sortSheet, setSortSheet] = useState(false);
  const [processing, setProcessing] = useState<MyTour | null>(null);
  const [overCapacity, setOverCapacity] = useState<MyTour | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const busy = useRef(new Set<number>());
  const request = useLatestRequest();
  const today = localToday();
  // 투어 역제안 알림 허용: 사용자별 설정(user_setting 'tourWishNotify'), 불러오기 전엔 null
  const [wishNotify, setWishNotify] = useState<boolean | null>(null);
  const savingWish = useRef(false);
  useEffect(() => {
    let active = true;
    api.getUserSettings()
      .then(res => { if (active) setWishNotify(res.settings.tourWishNotify === 'Y'); })
      .catch(() => { if (active) setWishNotify(false); });
    return () => { active = false; };
  }, []);
  const toggleWishNotify = async () => {
    if (wishNotify == null || savingWish.current) return;
    const next = !wishNotify;
    savingWish.current = true;
    setWishNotify(next);
    try {
      await api.updateUserSetting('tourWishNotify', next ? 'Y' : 'N');
    } catch (e) {
      setWishNotify(!next);
      showError(e);
    } finally {
      savingWish.current = false;
    }
  };

  const load = useCallback(async (mode: 'first' | 'quiet' | 'refresh' = 'first') => {
    const isCurrent = request.start();
    if (mode === 'first') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    try {
      const result = await api.getMyTours(tab, sort);
      if (!isCurrent()) return;
      setTours(result.tours); setError(false);
    } catch {
      if (isCurrent()) setError(true);
    } finally {
      if (isCurrent()) { setLoading(false); setRefreshing(false); }
    }
  }, [tab, sort, request]);
  useEffect(() => { void load('first'); }, [load]);
  // 수정 화면에서 돌아오면 다시 불러옴
  const loadRef = useRef(load); loadRef.current = load;
  const firstFocus = useRef(true);
  useFocusEffect(useCallback(() => {
    if (firstFocus.current) { firstFocus.current = false; return; }
    void loadRef.current('quiet');
  }, []));

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const patch = (id: number, value: Partial<MyTour>) => setTours(prev => prev.map(t => (t.id === id ? { ...t, ...value } : t)));
  const showError = (e: any) => { if (!e?._handled) Alert.alert('알림', e?.message ?? '처리하지 못했어요. 잠시 후 다시 시도해 주세요.'); };

  // + / − 1명씩 바로 저장, 다 찬 상태의 '+'는 인원 다시 설정 창
  const step = async (tour: MyTour, delta: 1 | -1) => {
    if (delta > 0 && tour.recruitedCount >= tour.capacity) { setOverCapacity(tour); return; }
    if (busy.current.has(tour.id)) return;
    busy.current.add(tour.id);
    try {
      const result = await api.stepRecruited(tour.id, delta);
      patch(tour.id, { recruitedCount: result.recruitedCount, capacity: result.capacity, status: result.status });
      setToast({ tourId: tour.id, text: `${result.recruitedCount} / ${result.capacity}명으로 바꿨어요`, undo: result.previous });
    } catch (e: any) {
      if (e?.code === 'FULL') setOverCapacity(tour);
      else { showError(e); void load('quiet'); }
    } finally {
      busy.current.delete(tour.id);
    }
  };

  const undo = async () => {
    if (!toast) return;
    const { tourId, undo: previous } = toast;
    setToast(null);
    try {
      const result = await api.setRecruitment(tourId, previous);
      patch(tourId, result);
    } catch (e) { showError(e); void load('quiet'); }
  };

  const saveRecruitment = async (value: { recruitedCount: number; capacity: number }) => {
    if (!overCapacity) return;
    try {
      const result = await api.setRecruitment(overCapacity.id, value);
      patch(overCapacity.id, result);
      setOverCapacity(null);
    } catch (e) { showError(e); }
  };

  const saveStatus = async (status: MyTour['status']) => {
    if (!processing) return;
    try {
      await api.setTourStatus(processing.id, status);
      setProcessing(null);
      // 투어 완료 · 모집 취소는 '지난 투어'로 옮겨감
      void load('quiet');
    } catch (e) { showError(e); }
  };

  // 같은 수정 화면: 공개 전이면 그 요청을 고치고, 공개 중이면 수정본만 승인 대기 (18장)
  const edit = (tour: MyTour) => router.push({ pathname: '/tour-create', params: { editId: String(tour.id) } });

  // 18장 수정 취소: 대기 중이거나 보완 요청을 받은 수정본을 버림 (공개 내용은 그대로)
  const cancelEdit = (tour: MyTour) => {
    Alert.alert('수정을 취소할까요?', `'${tour.title}'의 수정본을 버리고 지금 공개 중인 내용을 그대로 둬요.`, [
      { text: '닫기', style: 'cancel' },
      {
        text: '수정 취소', style: 'destructive', onPress: async () => {
          try { await api.cancelTourEdit(tour.id); patch(tour.id, { editRequest: null }); } catch (e) { showError(e); void load('quiet'); }
        },
      },
    ]);
  };

  // 10장 삭제 확인: 투어 이름과 함께, 모집된 인원이 있으면 따로 알리라고 안내
  const remove = (tour: MyTour) => {
    const notice = tour.recruitedCount > 0 ? `\n\n모집된 ${tour.recruitedCount}명에게는 따로 알려 주세요.` : '';
    // 보완 요청 투어의 '등록 취소'는 등록 요청을 거두고 투어를 지움
    const [title, message] = tour.status === 'REJECTED'
      ? ['등록을 취소할까요?', `'${tour.title}' 등록 요청을 취소하고 투어를 삭제해요. 되돌릴 수 없어요.`]
      : ['투어를 삭제할까요?', `'${tour.title}'을 삭제하면 되돌릴 수 없어요.${notice}`];
    const cancelRequest = tour.status === 'REJECTED';
    Alert.alert(title, message, [
      { text: cancelRequest ? '닫기' : '취소', style: 'cancel' },
      {
        text: cancelRequest ? '등록 취소' : '삭제', style: 'destructive', onPress: async () => {
          try {
            await api.deleteTour(tour.id);
            setTours(prev => prev.filter(t => t.id !== tour.id));
          } catch (e) { showError(e); }
        },
      },
    ]);
  };

  const openTour = (tour: { id: number }) => router.push({ pathname: '/tour-detail', params: { id: String(tour.id) } });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        {isPaneRoot ? <View style={styles.backButton} /> : (
          <StripBackSlot size={36}>
            <Pressable accessibilityRole="button" accessibilityLabel="뒤로" onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}>
              <GlassCircle fallbackStyle={styles.backCircle}>
                <Text style={styles.backArrow}>{'<'}</Text>
              </GlassCircle>
            </Pressable>
          </StripBackSlot>
        )}
        <Text style={styles.headerTitle}>투어 관리</Text>
        <View style={styles.backButton} />
      </View>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: !!wishNotify, disabled: wishNotify == null }}
        disabled={wishNotify == null}
        onPress={toggleWishNotify}
        style={({ pressed }) => [styles.wishNotify, wishNotify == null && { opacity: 0.4 }, pressed && { opacity: 0.6 }]}
      >
        <Ionicons name={wishNotify ? 'checkbox' : 'square-outline'} size={22} color={Colors.brand.white} />
        <Text style={styles.wishNotifyText}>투어 역제안 알림 허용</Text>
      </Pressable>

      <View style={styles.tabs}>
        {(['ongoing', 'past'] as Tab[]).map(value => (
          <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: tab === value }} onPress={() => setTab(value)} style={({ pressed }) => pressed && { opacity: 0.7 }}>
            <GlassChip active={tab === value} fallbackStyle={[styles.tabFallback, tab === value && styles.tabActive]}>
              <Text style={[styles.tabText, tab === value && styles.tabTextActive]}>{value === 'ongoing' ? '진행 중' : '지난 투어'}</Text>
            </GlassChip>
          </Pressable>
        ))}
        <View style={styles.toolbarRight}>
          <Pressable accessibilityRole="button" accessibilityLabel={`정렬: ${SORT_LABELS[sort]}`} onPress={() => setSortSheet(true)} style={({ pressed }) => [styles.sortButton, pressed && { opacity: 0.6 }]}>
            <Text style={styles.sortText}>{SORT_LABELS[sort]}</Text>
            <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.7)" />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="카드형 보기" hitSlop={6} onPress={() => setView('card')}>
            <Ionicons name="grid-outline" size={19} color={view === 'card' ? Colors.brand.white : 'rgba(255,255,255,0.35)'} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="목록형 보기" hitSlop={6} onPress={() => setView('list')}>
            <Ionicons name="list" size={22} color={view === 'list' ? Colors.brand.white : 'rgba(255,255,255,0.35)'} />
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="rgba(255,255,255,0.5)" /></View>
      ) : error && !tours.length ? (
        <Pressable onPress={() => load('first')} style={styles.center}>
          <Text style={styles.errorText}>투어를 불러오지 못했습니다. 눌러서 다시 시도해주세요.</Text>
        </Pressable>
      ) : (
        <FlatList
          data={tours}
          keyExtractor={tour => String(tour.id)}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 80 }, !tours.length && styles.listEmpty]}
          ItemSeparatorComponent={() => <View style={{ height: view === 'card' ? 12 : 8 }} />}
          renderItem={({ item }) => view === 'card'
            ? <ManageCard tour={item} today={today} onOpen={openTour} onStep={step} onProcess={setProcessing} onEdit={edit} onRemove={remove} onCancelEdit={cancelEdit} />
            : <TourRow tour={item} onPress={openTour} />}
          ListEmptyComponent={<TourEmpty message="등록한 투어가 없어요." />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} tintColor="rgba(255,255,255,0.6)" />}
          showsVerticalScrollIndicator={false}
        />
      )}

      {toast && (
        <View style={[styles.toast, { bottom: insets.bottom + 16 }]}>
          <Text style={styles.toastText}>{toast.text}</Text>
          <Pressable accessibilityRole="button" hitSlop={10} onPress={undo}>
            <Text style={styles.toastUndo}>되돌리기</Text>
          </Pressable>
        </View>
      )}

      <BottomSheet
        visible={sortSheet}
        onClose={() => setSortSheet(false)}
        title="정렬"
        items={SORTS.map(value => ({ label: SORT_LABELS[value], value }))}
        selectedValue={sort}
        fitContent
        onSelect={setSort}
      />
      <TourProcessPopup
        tour={processing && { title: processing.title, period: formatTourPeriod(processing.startDate, processing.endDate), status: processing.status }}
        onClose={() => setProcessing(null)}
        onSave={saveStatus}
      />
      <OverCapacityPopup tour={overCapacity} onClose={() => setOverCapacity(null)} onConfirm={saveRecruitment} />
    </View>
  );
}

function ManageCard({ tour, today, onOpen, onStep, onProcess, onEdit, onRemove, onCancelEdit }: {
  tour: MyTour; today: string;
  onOpen: (tour: MyTour) => void; onStep: (tour: MyTour, delta: 1 | -1) => void;
  onProcess: (tour: MyTour) => void; onEdit: (tour: MyTour) => void; onRemove: (tour: MyTour) => void;
  onCancelEdit: (tour: MyTour) => void;
}) {
  const actions = manageActions(tour.status);
  // 공개 중인 투어의 수정본 상태(18장)가 있으면 그 안내가 우선
  const editing = tour.editRequest;
  const notice = editNotice(editing) ?? wishNotice(tour.status, tour.wishOffer) ?? manageNotice(tour.status, tour.endDate, today, tour.reviewNote);
  const editLabel = editing?.status === 'REJECTED' ? '보완 후 재요청' : actions.editLabel;
  const meta = [tour.countryName, formatTourPeriod(tour.startDate, tour.endDate), tour.fee !== null ? `참가비 ${formatFee(tour.fee)}` : null].filter(Boolean).join('  ·  ');
  return (
    <View style={styles.card}>
      {/* 카드를 누르면 투어 상세 (공개 전이면 미리보기) */}
      <Pressable accessibilityRole="button" onPress={() => onOpen(tour)} style={({ pressed }) => pressed && { opacity: 0.7 }}>
        <View style={styles.cardTop}>
          <Text style={styles.cardTitle} numberOfLines={1}>{tour.title}</Text>
          <StatusBadge status={tour.status} />
        </View>
        <Text style={styles.cardMeta} numberOfLines={1}>{meta}</Text>
      </Pressable>
      {notice && <Text style={[styles.notice, (tour.status === 'REJECTED' || editing?.status === 'REJECTED') && styles.noticeRejected, (tour.status === 'PENDING' || editing?.status === 'PENDING') && styles.noticePending]}>{notice}</Text>}
      {editing && (
        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => onCancelEdit(tour)} style={({ pressed }) => [styles.cancelEdit, pressed && { opacity: 0.6 }]}>
          <Text style={styles.cancelEditText}>수정 취소</Text>
        </Pressable>
      )}

      {actions.adjust && (
        <View style={styles.recruit}>
          <Text style={styles.recruitLabel}>모집현황</Text>
          <View style={styles.stepper}>
            <StepButton icon="remove" label="모집된 인원 1명 빼기" disabled={tour.recruitedCount <= 0} onPress={() => onStep(tour, -1)} />
            <Text style={styles.recruitValue}>{tour.recruitedCount} / {tour.capacity}명</Text>
            <StepButton icon="add" label="모집된 인원 1명 더하기" onPress={() => onStep(tour, 1)} />
          </View>
        </View>
      )}

      <View style={styles.cardButtons}>
        {actions.process && <CardButton label="처리" onPress={() => onProcess(tour)} />}
        {actions.edit && <CardButton label={editLabel} onPress={() => onEdit(tour)} />}
        {actions.remove && <CardButton label={actions.removeLabel} danger onPress={() => onRemove(tour)} />}
      </View>
    </View>
  );
}

// 누르는 영역 44pt
function StepButton({ icon, label, disabled, onPress }: { icon: 'add' | 'remove'; label: string; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.stepButton, disabled && { opacity: 0.3 }, pressed && { opacity: 0.6 }]}
    >
      <View style={styles.stepCircle}><Ionicons name={icon} size={18} color={Colors.brand.white} /></View>
    </Pressable>
  );
}

function CardButton({ label, danger, onPress }: { label: string; danger?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.cardButton, pressed && { opacity: 0.6 }]}>
      <Text style={[styles.cardButtonText, danger && styles.danger]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.brand.primary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 52, paddingHorizontal: SIDE },
  backButton: { width: 36, height: 36 },
  backCircle: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  backArrow: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.white, marginRight: 1 },
  headerTitle: { fontFamily: 'SUIT-Bold', fontSize: 18, color: Colors.brand.white },
  wishNotify: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: SIDE },
  wishNotifyText: { fontFamily: 'SUIT-SemiBold', fontSize: 14, color: Colors.brand.white },
  tabs: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: SIDE, paddingTop: 4, paddingBottom: 12 },
  tabFallback: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.08)' },
  tabActive: { backgroundColor: 'rgba(255,255,255,0.22)' },
  tabText: { fontFamily: 'SUIT-SemiBold', fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  tabTextActive: { color: Colors.brand.white },
  toolbarRight: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 12 },
  sortButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sortText: { fontFamily: 'SUIT-Regular', fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  errorText: { fontFamily: 'SUIT-Regular', fontSize: 15, color: 'rgba(255,255,255,0.35)', textAlign: 'center' },
  list: { paddingHorizontal: SIDE },
  listEmpty: { flexGrow: 1 },
  card: { borderRadius: 14, padding: 16, backgroundColor: 'rgba(255,255,255,0.1)', gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitle: { flex: 1, fontFamily: 'SUIT-Bold', fontSize: 17, color: Colors.brand.white },
  cardMeta: { fontFamily: 'SUIT-Regular', fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  notice: {
    fontFamily: 'SUIT-SemiBold', fontSize: 12, lineHeight: 18, color: '#FFD166',
    padding: 10, borderRadius: 10, backgroundColor: 'rgba(255,209,102,0.12)',
  },
  cancelEdit: { alignSelf: 'flex-end', marginTop: -4 },
  cancelEditText: { fontFamily: 'SUIT-SemiBold', fontSize: 13, color: '#FF8A7A', textDecorationLine: 'underline' },
  noticePending: { color: '#D6C2FF', backgroundColor: 'rgba(183,148,244,0.15)' },
  noticeRejected: { color: '#FFC58A', backgroundColor: 'rgba(255,159,67,0.15)' },
  recruit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recruitLabel: { fontFamily: 'SUIT-Regular', fontSize: 13, color: 'rgba(255,255,255,0.55)' },
  stepper: { flexDirection: 'row', alignItems: 'center' },
  stepButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  stepCircle: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  recruitValue: { minWidth: 70, textAlign: 'center', fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.white },
  cardButtons: { flexDirection: 'row', gap: 8 },
  cardButton: {
    flex: 1, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  cardButtonText: { fontFamily: 'SUIT-SemiBold', fontSize: 14, color: Colors.brand.white },
  danger: { color: '#FF8A7A' },
  toast: {
    position: 'absolute', left: SIDE, right: SIDE,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, backgroundColor: 'rgba(5,20,40,0.92)',
  },
  toastText: { fontFamily: 'SUIT-SemiBold', fontSize: 14, color: Colors.brand.white },
  toastUndo: { fontFamily: 'SUIT-Bold', fontSize: 14, color: '#00E5FF' },
});
