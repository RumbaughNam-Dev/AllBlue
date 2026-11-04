import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Pressable, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter, usePreventRemove } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { api, TourStatus } from '@/services/api';
import BottomSheet from '@/components/BottomSheet';
import DatePickerSheet from '@/components/DatePickerSheet';
import GlassCircle from '@/components/GlassCircle';
import GlassBackground, { glassClear } from '@/components/GlassBackground';
import StripBackSlot from '@/components/StripBackSlot';
import TourImageGrid from './TourImageGrid';
import TourLinkPopup from './TourLinkPopup';
import { regionName, useTourRegions } from './useTourRegions';
import {
  EMPTY_TOUR_FORM, TOUR_FORM_LIMITS as L, TourField, TourForm, digitsOnly, formFromTour, formatFee, isTourFormDirty, localToday, moveItem,
  toTourRequest, tourFormErrors,
} from './tourForm';

// Main actions stay white (prominent glass) so the navy label keeps its contrast.
const PROMINENT_TINT = 'rgba(255,255,255,0.85)';
const ERROR = '#FF6B6B';
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const SIDE = 24;

type Sheet = 'continent' | 'country' | 'start' | 'end' | null;

// 4장 투어 만들기 (강사 · admin). 5장 입력 검사: 칸을 벗어나면 라벨 옆 빨간 글씨 + 빨간 테두리, 고치면 바로 사라짐.
export default function TourCreateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // 10장 '수정' · '수정 후 재요청'은 같은 화면 (승인 대기 · 불허 투어)
  // 역제안 목록의 '이 제안으로 투어 만들기': 지역 · 기간 · 모집 인원을 미리 채움
  // wishId가 있으면 등록 요청이 그 역제안과 묶이고 제안자에게 바로 알림
  const { editId, wishId, wishContinent, wishCountry, wishStart, wishEnd, wishCapacity } = useLocalSearchParams<{
    editId?: string; wishId?: string; wishContinent?: string; wishCountry?: string; wishStart?: string; wishEnd?: string; wishCapacity?: string;
  }>();
  const editing = !!editId;
  const fromWish = useMemo<TourForm>(() => (editId || !wishCountry ? EMPTY_TOUR_FORM : {
    ...EMPTY_TOUR_FORM,
    continentCode: wishContinent ?? '', countryCode: wishCountry, startDate: wishStart ?? '', endDate: wishEnd ?? '', capacity: wishCapacity ?? '',
  }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [form, setForm] = useState<TourForm>(fromWish);
  const [initial, setInitial] = useState<TourForm>(fromWish);
  const [editState, setEditState] = useState<{ status: TourStatus; recruitedCount: number; reviewNote: string | null; isPublic: boolean } | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(editing);
  const [touched, setTouched] = useState<Partial<Record<TourField, boolean>>>({});
  const [sheet, setSheet] = useState<Sheet>(null);
  const { continents, countries, failed: regionsFailed, reload: loadRegions, countriesOf } = useTourRegions();
  const [dragging, setDragging] = useState(false);
  const [addingLink, setAddingLink] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const today = localToday();

  const update = <K extends keyof TourForm>(key: K, value: TourForm[K]) => setForm(prev => ({ ...prev, [key]: value }));
  const touch = (field: TourField) => setTouched(prev => (prev[field] ? prev : { ...prev, [field]: true }));
  const errors = useMemo(() => tourFormErrors(form, today, editState?.recruitedCount ?? 0), [form, today, editState]);

  // 17장: 새 투어는 프로필 링크로 문의 링크를 미리 채움 (작성 중 바뀐 것으로 치지 않음). 없으면 바로 '1개 이상' 안내
  useEffect(() => {
    if (editId) return;
    let alive = true;
    api.getProfileLinks().then(({ links }) => {
      if (!alive) return;
      if (links.length) {
        setForm(prev => (prev.links.length ? prev : { ...prev, links }));
        setInitial(prev => ({ ...prev, links }));
      } else touch('links');
    }).catch(() => { if (alive) touch('links'); });
    return () => { alive = false; };
  }, [editId]);

  useEffect(() => {
    if (!editId) return;
    let alive = true;
    api.getTour(Number(editId)).then(({ tour, links }) => {
      if (!alive) return;
      // 18장: 공개 중인 투어에 수정본이 있으면 이어서 고침 (보완 요청을 받았으면 그 내용도 보임)
      const draft = tour.editRequest?.payload;
      const loaded = draft ? formFromTour(draft, draft.links.slice(0, L.linkMax)) : formFromTour(tour, links.slice(0, L.linkMax));
      setForm(loaded); setInitial(loaded);
      const isPublic = ['PREPARING', 'RECRUITING', 'CLOSED'].includes(tour.status);
      const note = isPublic ? (tour.editRequest?.status === 'REJECTED' ? tour.editRequest.reviewNote : null) : tour.reviewNote ?? null;
      setEditState({ status: tour.status, recruitedCount: tour.recruitedCount, reviewNote: note, isPublic });
      // 이미 저장된 값이라 처음부터 검사 결과를 보여줌
      setTouched({ images: true, title: true, region: true, period: true, capacity: true, links: true });
    }).catch((e: any) => {
      if (!alive) return;
      Alert.alert('투어를 불러오지 못했어요', e?.message, [{ text: '확인', onPress: () => router.back() }]);
    }).finally(() => { if (alive) setLoadingEdit(false); });
    return () => { alive = false; };
  }, [editId]);
  const resubmit = editState?.status === 'REJECTED';
  const shown = (field: TourField) => (touched[field] ? errors[field] : undefined);
  const valid = Object.keys(errors).length === 0;

  // 작성 · 수정 중 뒤로가기는 확인 (바뀐 게 없으면 바로 나감)
  const disablePrevention = usePreventRemove(isTourFormDirty(form, initial) && !submitting, ({ repeat }) => {
    Alert.alert('작성 중인 내용이 사라져요. 나갈까요?', undefined, [
      { text: '취소', style: 'cancel' },
      { text: '나가기', style: 'destructive', onPress: () => { disablePrevention(); repeat(); } },
    ]);
  });

  const continentCountries = countriesOf(form.continentCode);

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '사진 라이브러리 접근 권한이 필요합니다.');
      return;
    }
    const remaining = L.imageMax - form.images.length;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: remaining, quality: 0.8,
    });
    touch('images');
    if (result.canceled || !result.assets?.length) return;
    const tooBig = result.assets.filter(a => a.fileSize && a.fileSize > MAX_FILE_SIZE).length;
    const picked = result.assets
      .filter(a => !(a.fileSize && a.fileSize > MAX_FILE_SIZE))
      .map(a => ({ uri: a.uri, mimeType: a.mimeType ?? 'image/jpeg' }));
    setForm(prev => {
      const known = new Set(prev.images.map(i => i.uri));
      return { ...prev, images: [...prev.images, ...picked.filter(i => !known.has(i.uri))].slice(0, L.imageMax) };
    });
    if (tooBig) Alert.alert('알림', '10MB가 넘는 사진은 빼고 올렸어요.');
  };

  const submit = async () => {
    if (!valid || submittingRef.current) return;
    submittingRef.current = true; // 누르면 바로 잠겨서 두 번 요청되지 않음
    setSubmitting(true);
    try {
      const urls: string[] = [];
      // 이미 올린 사진은 그대로, 새로 고른 사진만 올림
      for (const image of form.images) urls.push(image.remote ? image.uri : (await api.uploadTourImage(image.uri, image.mimeType)).url);
      if (editing) await api.updateTour(Number(editId), toTourRequest(form, urls));
      else await api.createTourRequest(toTourRequest(form, urls), wishId ? Number(wishId) : undefined);
      disablePrevention();
      const [title, message] = editState?.isPublic
        ? ['수정 요청을 보냈어요', '관리자가 확인하면 반영돼요. 그 전까지는 이전 내용이 보여요.']
        : editing && !resubmit
          ? ['수정했어요', '승인을 기다리는 요청에 바로 반영했어요.']
          : wishId
            ? ['등록 요청을 보냈어요', '제안자에게 바로 알렸어요. 제안자가 응하고 관리자가 승인하면 정식 투어로 공개돼요.']
            : ['등록 요청을 보냈어요', '관리자가 확인한 뒤 공개돼요. 승인되면 알림으로 알려드려요.'];
      Alert.alert(title, message, [
        { text: '확인', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      submittingRef.current = false;
      setSubmitting(false);
      if (!e?._handled) Alert.alert('등록 요청을 보내지 못했어요', e?.message ?? '잠시 후 다시 시도해 주세요.');
    }
  };

  const contentWidth = width - insets.left - insets.right - SIDE * 2;

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <StripBackSlot size={36}>
          <Pressable accessibilityRole="button" accessibilityLabel="뒤로" onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}>
            <GlassCircle fallbackStyle={styles.backCircle}>
              <Text style={styles.backArrow}>{'<'}</Text>
            </GlassCircle>
          </Pressable>
        </StripBackSlot>
        <Text style={styles.headerTitle}>{editing ? '투어 수정' : '투어 만들기'}</Text>
        <View style={{ width: 36 }} />
      </View>

      {loadingEdit ? (
        <View style={styles.loading}><ActivityIndicator size="large" color="rgba(255,255,255,0.5)" /></View>
      ) : (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          scrollEnabled={!dragging}
        >
          {/* 보완 후 재요청: 관리자가 적은 보완 내용을 맨 위에 */}
          {editState?.reviewNote && (
            <View style={styles.reviewNote}>
              <Text style={styles.reviewNoteTitle}>관리자 보완 요청</Text>
              <Text style={styles.reviewNoteText}>{editState.reviewNote}</Text>
            </View>
          )}
          <FieldLabel text="소개 이미지" required note={`최대 ${L.imageMax}장 · 첫 장이 대표`} error={shown('images')} />
          <TourImageGrid
            images={form.images}
            max={L.imageMax}
            width={contentWidth}
            error={!!shown('images')}
            onAdd={pickImages}
            onRemove={index => { touch('images'); update('images', form.images.filter((_, i) => i !== index)); }}
            onMove={(from, to) => update('images', moveItem(form.images, from, to))}
            onDragChange={setDragging}
          />
          <Text style={styles.guide}>투어 소개는 이미지로만 올려 주세요. 일정 · 준비물 · 자격 조건을 이미지에 담아 주세요.</Text>

          <FieldLabel text="투어명" required error={shown('title')} />
          <TextInput
            style={[styles.input, shown('title') && styles.inputError]}
            value={form.title}
            onChangeText={text => update('title', text)}
            onBlur={() => touch('title')}
            placeholder="예) 세부 펀다이빙 3박 4일"
            placeholderTextColor="rgba(255,255,255,0.25)"
            maxLength={L.titleMax}
            returnKeyType="done"
          />

          <FieldLabel text="지역" required error={shown('region')} />
          <View style={styles.row}>
            <Selector
              label={regionName(continents, form.continentCode) || '대륙 선택'}
              placeholder={!form.continentCode}
              error={!!shown('region') && !form.continentCode}
              onPress={() => (regionsFailed ? loadRegions() : setSheet('continent'))}
            />
            <Selector
              label={regionName(countries, form.countryCode) || '나라 선택'}
              placeholder={!form.countryCode}
              disabled={!form.continentCode}
              error={!!shown('region') && !!form.continentCode && !form.countryCode}
              onPress={() => setSheet('country')}
            />
          </View>
          {regionsFailed && <Text style={styles.retry}>지역 목록을 불러오지 못했어요. 대륙 선택을 다시 눌러 주세요.</Text>}

          <FieldLabel text="투어 기간" required error={shown('period')} />
          <View style={styles.row}>
            <Selector label={form.startDate.replace(/-/g, '.') || '시작일'} placeholder={!form.startDate} error={!!shown('period')} icon="calendar-outline" onPress={() => setSheet('start')} />
            <Text style={styles.tilde}>~</Text>
            <Selector label={form.endDate.replace(/-/g, '.') || '종료일'} placeholder={!form.endDate} error={!!shown('period')} icon="calendar-outline" onPress={() => setSheet('end')} />
          </View>

          <View style={styles.row}>
            <View style={styles.half}>
              <FieldLabel text="모집 인원" required error={shown('capacity')} />
              <Suffixed suffix="명" error={!!shown('capacity')}>
                <TextInput
                  style={styles.suffixedInput}
                  value={form.capacity}
                  onChangeText={text => update('capacity', digitsOnly(text).slice(0, 2))}
                  onBlur={() => touch('capacity')}
                  placeholder="예) 8"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  keyboardType="number-pad"
                />
              </Suffixed>
            </View>
            <View style={styles.half}>
              <FieldLabel text="참가비" />
              <Suffixed suffix="원">
                <TextInput
                  style={styles.suffixedInput}
                  value={formatFee(form.fee)}
                  onChangeText={text => update('fee', digitsOnly(text).slice(0, 10))}
                  placeholder="예) 1,200,000"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  keyboardType="number-pad"
                />
              </Suffixed>
            </View>
          </View>

          <ItemList title="포함 사항" mark="✓" items={form.included} onChange={items => update('included', items)} />
          <ItemList title="불포함 사항" mark="✕" items={form.excluded} onChange={items => update('excluded', items)} />

          <FieldLabel text="문의 링크" required note={`${form.links.length}/${L.linkMax}`} error={shown('links')} />
          {form.links.map((link, index) => (
            <View key={`${index}-${link.url}`} style={styles.item}>
              <Ionicons name="link" size={15} color="#00E5FF" />
              <View style={{ flex: 1 }}>
                <Text style={styles.itemText} numberOfLines={1}>{link.name}</Text>
                <Text style={styles.linkUrl} numberOfLines={1}>{link.url}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${link.name} 삭제`}
                hitSlop={8}
                onPress={() => { touch('links'); update('links', form.links.filter((_, i) => i !== index)); }}
              >
                <Ionicons name="close" size={16} color="rgba(255,255,255,0.5)" />
              </Pressable>
            </View>
          ))}
          {form.links.length < L.linkMax && (
            <Pressable
              accessibilityRole="button"
              onPress={() => setAddingLink(true)}
              style={({ pressed }) => [styles.linkAdd, shown('links') && styles.inputError, pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.linkAddText}>＋ 링크 추가</Text>
            </Pressable>
          )}
          <Text style={styles.guide}>참가 문의를 받을 곳이에요. 상세의 '문의하기'를 누르면 열려요.{!editing && form.links.length === 0 ? '\n프로필에 링크를 넣어 두면 다음 투어부터 자동으로 채워져요.' : ''}</Text>
        </ScrollView>

        <View style={styles.bottomArea}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !valid || submitting }}
            style={({ pressed }) => [styles.submitButton, glassClear, pressed && { opacity: 0.85 }, (!valid || submitting) && { opacity: 0.45 }]}
            onPress={submit}
            disabled={!valid || submitting}
          >
            <GlassBackground radius={14} interactive tintColor={PROMINENT_TINT} />
            {submitting ? <ActivityIndicator color={Colors.brand.primary} /> : <Text style={styles.submitText}>{!editing ? '등록 요청' : resubmit ? '보완 후 재요청' : editState?.isPublic ? '수정 요청' : '수정 저장'}</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      )}

      <TourLinkPopup
        visible={addingLink}
        onClose={() => setAddingLink(false)}
        onAdd={link => { setAddingLink(false); touch('links'); setForm(prev => ({ ...prev, links: [...prev.links, link].slice(0, L.linkMax) })); }}
      />
      <BottomSheet
        visible={sheet === 'continent'}
        onClose={() => { setSheet(null); touch('region'); }}
        title="대륙"
        items={continents.map(c => ({ label: c.nameKo ?? c.name, value: c.code }))}
        selectedValue={form.continentCode}
        fitContent
        onSelect={code => {
          // 대륙을 바꾸면 나라는 다시 선택
          if (code !== form.continentCode) setForm(prev => ({ ...prev, continentCode: code, countryCode: '' }));
        }}
      />
      <BottomSheet
        visible={sheet === 'country'}
        onClose={() => { setSheet(null); touch('region'); }}
        title={`나라 (${regionName(continents, form.continentCode)})`}
        items={continentCountries.map(c => ({ label: c.nameKo ?? c.name, value: c.code }))}
        selectedValue={form.countryCode}
        searchable={continentCountries.length > 8}
        onSelect={code => update('countryCode', code)}
      />
      <DatePickerSheet
        visible={sheet === 'start'}
        onClose={() => { setSheet(null); touch('period'); }}
        selectedDate={form.startDate}
        minDate={today}
        onSelect={date => setForm(prev => ({ ...prev, startDate: date, endDate: prev.endDate || date }))}
      />
      <DatePickerSheet
        visible={sheet === 'end'}
        onClose={() => { setSheet(null); touch('period'); }}
        selectedDate={form.endDate || form.startDate}
        minDate={form.startDate || today}
        onSelect={date => update('endDate', date)}
      />
    </View>
  );
}

function FieldLabel({ text, required, note, error }: { text: string; required?: boolean; note?: string; error?: string }) {
  return (
    <View style={styles.labelRow}>
      <Text style={styles.label}>{text}{required && <Text style={styles.required}> *</Text>}</Text>
      {note && !error && <Text style={styles.note}>{note}</Text>}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

function Selector({ label, placeholder, disabled, error, icon = 'chevron-down', onPress }: {
  label: string; placeholder?: boolean; disabled?: boolean; error?: boolean; icon?: 'chevron-down' | 'calendar-outline'; onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.selector, error && styles.inputError, disabled && { opacity: 0.4 }, pressed && { opacity: 0.7 }]}
    >
      <Text style={[styles.selectorText, placeholder && styles.placeholder]} numberOfLines={1}>{label}</Text>
      <Ionicons name={icon} size={16} color="rgba(255,255,255,0.5)" />
    </Pressable>
  );
}

function Suffixed({ suffix, error, children }: { suffix: string; error?: boolean; children: React.ReactNode }) {
  return (
    <View style={[styles.suffixed, error && styles.inputError]}>
      {children}
      <Text style={styles.suffix}>{suffix}</Text>
    </View>
  );
}

// 포함 · 불포함: 한 줄씩 추가 · 삭제 (한 줄 40자, 20줄까지)
function ItemList({ title, mark, items, onChange }: { title: string; mark: string; items: string[]; onChange: (items: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const line = draft.trim();
    if (!line || items.length >= L.itemCount) return;
    onChange([...items, line]);
    setDraft('');
  };
  return (
    <View>
      <FieldLabel text={title} note={`${items.length}/${L.itemCount}`} />
      {items.map((item, index) => (
        <View key={`${index}-${item}`} style={styles.item}>
          <Text style={styles.itemMark}>{mark}</Text>
          <Text style={styles.itemText}>{item}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`${item} 삭제`} hitSlop={8} onPress={() => onChange(items.filter((_, i) => i !== index))}>
            <Ionicons name="close" size={16} color="rgba(255,255,255,0.5)" />
          </Pressable>
        </View>
      ))}
      {items.length < L.itemCount && (
        <View style={styles.itemAdd}>
          <TextInput
            style={styles.itemInput}
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={add}
            blurOnSubmit={false}
            placeholder="+ 항목 추가"
            placeholderTextColor="rgba(255,255,255,0.3)"
            maxLength={L.itemLength}
            returnKeyType="done"
          />
          {!!draft.trim() && (
            <Pressable accessibilityRole="button" accessibilityLabel={`${title} 추가`} onPress={add} style={({ pressed }) => [styles.itemAddButton, pressed && { opacity: 0.6 }]}>
              <Text style={styles.itemAddText}>추가</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.brand.primary },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  reviewNote: { marginTop: 8, padding: 14, borderRadius: 12, backgroundColor: 'rgba(255,159,67,0.15)', gap: 6 },
  reviewNoteTitle: { fontFamily: 'SUIT-Bold', fontSize: 13, color: '#FFC58A' },
  reviewNoteText: { fontFamily: 'SUIT-Regular', fontSize: 14, lineHeight: 20, color: Colors.brand.white },
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
  scroll: { paddingHorizontal: SIDE, paddingTop: 8, paddingBottom: 24 },
  labelRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 20, marginBottom: 8 },
  label: { fontFamily: 'SUIT-SemiBold', fontSize: 14, color: Colors.brand.white },
  required: { color: '#00E5FF' },
  note: { fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  error: { fontFamily: 'SUIT-SemiBold', fontSize: 12, color: ERROR, flexShrink: 1 },
  guide: { fontFamily: 'SUIT-Regular', fontSize: 12, lineHeight: 18, color: 'rgba(255,255,255,0.45)', marginTop: 10 },
  input: {
    fontFamily: 'SUIT-Regular', fontSize: 16, color: Colors.brand.white,
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  inputError: { borderColor: ERROR },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  half: { flex: 1 },
  tilde: { fontFamily: 'SUIT-Regular', fontSize: 16, color: 'rgba(255,255,255,0.5)' },
  selector: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  selectorText: { flex: 1, fontFamily: 'SUIT-Regular', fontSize: 15, color: Colors.brand.white },
  placeholder: { color: 'rgba(255,255,255,0.35)' },
  retry: { fontFamily: 'SUIT-Regular', fontSize: 12, color: ERROR, marginTop: 6 },
  suffixed: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  suffixedInput: { flex: 1, fontFamily: 'SUIT-Regular', fontSize: 16, color: Colors.brand.white, paddingVertical: 14 },
  suffix: { fontFamily: 'SUIT-Regular', fontSize: 15, color: 'rgba(255,255,255,0.5)', marginLeft: 6 },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 14, marginBottom: 6,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10,
  },
  itemMark: { fontFamily: 'SUIT-Bold', fontSize: 14, color: '#00E5FF', width: 14, textAlign: 'center' },
  itemText: { flex: 1, fontFamily: 'SUIT-Regular', fontSize: 15, color: Colors.brand.white },
  linkUrl: { fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  linkAdd: {
    alignItems: 'center', paddingVertical: 13,
    borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.2)',
  },
  linkAddText: { fontFamily: 'SUIT-SemiBold', fontSize: 15, color: '#00E5FF' },
  itemAdd: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14,
  },
  itemInput: { flex: 1, fontFamily: 'SUIT-Regular', fontSize: 15, color: Colors.brand.white, paddingVertical: 12 },
  itemAddButton: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.15)' },
  itemAddText: { fontFamily: 'SUIT-SemiBold', fontSize: 13, color: Colors.brand.white },
  bottomArea: { paddingHorizontal: SIDE, paddingVertical: 12 },
  submitButton: {
    height: 54, borderRadius: 14,
    backgroundColor: Colors.brand.white,
    alignItems: 'center', justifyContent: 'center',
  },
  submitText: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.primary },
});
