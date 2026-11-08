import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Pressable, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter, usePreventRemove } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/Colors';
import { api, TourStatus } from '@/services/api';
import BottomSheet from '@/components/BottomSheet';
import DatePickerSheet from '@/components/DatePickerSheet';
import GlassBackground, { glassClear } from '@/components/GlassBackground';
import { UploadProgressPopup, useUploadProgress } from '@/components/UploadProgress';
import TourImageGrid from './TourImageGrid';
import TourLinkPopup from './TourLinkPopup';
import { regionName, useTourRegions } from './useTourRegions';
import { pickPhotos, removePhoto, uploadPhotos } from './photos';
import {
  Chips, FieldLabel, formStyles as fs, ItemList, LinkList, Selector, SIDE, STYLE_OPTIONS, Stepper, Suffixed, TourHeader,
} from './FormParts';
import {
  TOUR_FORM_LIMITS as L, TourField, TourForm, baseMin, digitsOnly, emptyTourForm, feeDigits, formFromTour, isDirty, localToday, moveItem,
  registerOutcome, toTourInput, tourFormErrors,
} from './tourForm';
import { STYLE_LABEL, TOUR_STATUS, formatTourPeriod } from './ui';

const PROMINENT_TINT = 'rgba(255,255,255,0.85)';
type Sheet = 'continent' | 'country' | 'start' | 'end' | null;
type EditState = { status: TourStatus; joinedCount: number; reviewNote: string | null; isPublic: boolean };

// 4 · 5장 투어 등록 (수정도 같은 화면, ?id=). 역할: 참여자로(누구나, 바로 공개) · 인솔자로(강사 · admin, admin 승인 뒤 공개)
// 입력 검사: 칸을 벗어나면 라벨 옆 빨간 글씨 + 빨간 테두리, 고치면 바로 사라짐
export default function TourRegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = !!id;
  const [form, setForm] = useState<TourForm>(emptyTourForm());
  const [initial, setInitial] = useState<TourForm>(emptyTourForm());
  const [canLead, setCanLead] = useState(false);
  const [registeredToday, setRegisteredToday] = useState(false);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [loading, setLoading] = useState(true);
  const [touched, setTouched] = useState<Partial<Record<TourField, boolean>>>({});
  const [sheet, setSheet] = useState<Sheet>(null);
  const { continents, countries, failed: regionsFailed, reload: loadRegions, countriesOf } = useTourRegions();
  const [dragging, setDragging] = useState(false);
  const [addingLink, setAddingLink] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const uploads = useUploadProgress();
  const today = localToday();
  const leader = form.role === 'LEADER';

  const update = <K extends keyof TourForm>(key: K, value: TourForm[K]) => setForm(prev => ({ ...prev, [key]: value }));
  const touch = (field: TourField) => setTouched(prev => (prev[field] ? prev : { ...prev, [field]: true }));
  const errors = useMemo(() => tourFormErrors(form, today, editState?.joinedCount ?? 0), [form, today, editState]);
  const shown = (field: TourField) => (touched[field] ? errors[field] : undefined);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (editing) {
          const { tour, links } = await api.getTour(Number(id));
          if (!alive) return;
          // 공개 중인 인솔자 투어에 수정본이 있으면 이어서 고침 (보완 요청을 받았으면 그 내용도 보임)
          const draft = tour.editRequest?.payload as (Parameters<typeof formFromTour>[0] & { links: TourForm['links'] }) | undefined;
          const base = { registerRole: tour.registerRole, capacity: tour.capacity, baseCount: tour.baseCount };
          // 장소가 없던 예전 수정본이면 지금 공개 중인 장소로
          const loaded = draft ? formFromTour({ place: tour.place, ...draft, ...base }, draft.links.slice(0, L.linkMax)) : formFromTour(tour, links.slice(0, L.linkMax));
          setForm(loaded); setInitial(loaded);
          const isPublic = ['RECRUITING', 'SEEKING_LEADER'].includes(tour.status);
          const note = isPublic ? (tour.editRequest?.status === 'REJECTED' ? tour.editRequest.reviewNote : null) : tour.reviewNote;
          setEditState({ status: tour.status, joinedCount: tour.joinedCount, reviewNote: note, isPublic });
          // 이미 저장된 값이라 처음부터 검사 결과를 보여줌
          setTouched({ images: true, region: true, place: true, period: true, style: true, counts: true, title: true, links: true });
        } else {
          const options = await api.getTourRegisterOptions();
          if (!alive) return;
          setCanLead(options.canLead);
          setRegisteredToday(options.registeredToday);
        }
      } catch (e: any) {
        if (!alive) return;
        Alert.alert(editing ? '투어를 불러오지 못했어요' : '등록 화면을 열지 못했어요', e?.message, [{ text: '확인', onPress: () => router.back() }]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 역할을 바꾸면 칸이 달라짐: 문의 링크는 투어마다 따로 넣어 빈 채로 시작 (프로필 링크와 연동 안 함)
  const chooseRole = (role: TourForm['role']) => {
    if (role === form.role) return;
    setForm(prev => ({ ...prev, role, links: [], baseCount: Math.max(baseMin(role), Math.min(prev.baseCount, prev.capacity)) }));
    setInitial(prev => ({ ...prev, role, links: [], baseCount: Math.max(baseMin(role), Math.min(prev.baseCount, prev.capacity)) }));
    if (role === 'LEADER') touch('links');
  };

  const resubmit = editState?.status === 'REVISION';
  const valid = Object.keys(errors).length === 0;
  const blockedToday = !editing && !leader && registeredToday;

  // 작성 · 수정 중 뒤로가기는 확인 (바뀐 게 없으면 바로 나감)
  const disablePrevention = usePreventRemove(isDirty(form, initial) && !submitting, ({ repeat }) => {
    Alert.alert('작성 중인 내용이 사라져요. 나갈까요?', undefined, [
      { text: '취소', style: 'cancel' },
      { text: '나가기', style: 'destructive', onPress: () => { disablePrevention(); repeat(); } },
    ]);
  });

  const addPhotos = async () => {
    touch('images');
    const next = await pickPhotos(form.images, L.imageMax);
    if (next) setForm(prev => ({ ...prev, images: next, coverUri: prev.coverUri || next[0]?.uri || '' }));
  };

  const outcome = registerOutcome(form);
  const left = form.capacity - form.baseCount;
  const outcomeText = leader
    ? left > 0 ? `${left}자리를 모집해요 → 승인되면 '참여자 모집중'으로 공개돼요` : "다 모였어요 → 승인되면 '모집 마감'으로 기록돼요"
    : left > 0 ? `${left}자리가 남아요 → '참여자 모집중'으로 등록돼요` : "다 모였어요 → '인솔자 모집중'으로 바로 강사님들께 알려요";

  // 4 · 5장 확인 창: 등록될 상태를 미리 알려줌
  const confirmAndSubmit = () => {
    if (!valid || submittingRef.current || blockedToday) return;
    if (editing) { void submit(); return; }
    const summary = `${regionName(countries, form.countryCode)} · ${form.place.trim().replace(/\s+/g, ' ')} · ${STYLE_LABEL[form.tourStyle as keyof typeof STYLE_LABEL]}\n${formatTourPeriod(form.startDate, form.endDate)} · ${form.capacity}명 중 ${form.baseCount}명 모임`;
    const message = leader
      ? `${summary}\n\n승인 대기 → ${TOUR_STATUS[outcome].label}\n${left > 0 ? "admin이 승인하면 '참여자 모집중'으로 공개돼요." : "인원이 다 모였어요. admin이 승인하면 '모집 마감'으로 기록돼요. 홈의 '모집 마감' 줄과 검색, 내 프로필 '투어'에 보여요."}`
      : `${summary}\n\n${TOUR_STATUS[outcome].label}\n${left > 0 ? `${left}자리를 먼저 모집해요. 다 모이면 강사님들께 인솔 제안 요청 알림이 가요.` : '인원이 다 모여 강사님들께 바로 인솔 제안 요청 알림이 가요.'}\n\n무분별한 등록은 이용 제한 사유가 될 수 있어요.`;
    Alert.alert(leader ? '등록 요청할까요?' : '투어를 등록할까요?', message, [
      { text: '취소', style: 'cancel' },
      { text: leader ? '등록 요청' : '등록', onPress: () => void submit() },
    ]);
  };

  const submit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true; // 누르면 바로 잠겨서 두 번 요청되지 않음
    setSubmitting(true);
    try {
      const input = toTourInput(form, await uploadPhotos(form.images, uploads.run, leader ? '소개 이미지' : '사진'));
      if (editing) {
        const result = await api.updateTour(Number(id), input);
        disablePrevention();
        const [title, message] = resubmit
          ? ['보완 후 다시 요청했어요', '관리자가 확인한 뒤 공개돼요.']
          : result.editPending
            ? ['수정 요청을 보냈어요', '관리자가 확인하면 반영돼요. 그 전까지는 이전 내용이 보여요.']
            : ['수정했어요', editState?.isPublic ? '참여자 · 신청자 · 제안한 강사님께 바뀐 내용을 알렸어요.' : '승인을 기다리는 요청에 바로 반영했어요.'];
        Alert.alert(title, message, [{ text: '확인', onPress: () => router.back() }]);
      } else {
        const result = await api.createTour(input);
        disablePrevention();
        const [title, message] = leader
          ? ['등록 요청을 보냈어요', '관리자가 확인한 뒤 공개돼요. 승인되면 알림으로 알려드려요.']
          : ['투어를 등록했어요', `'${TOUR_STATUS[result.status].label}'으로 공개됐어요.`];
        Alert.alert(title, message, [{ text: '확인', onPress: () => router.back() }]);
      }
    } catch (e: any) {
      submittingRef.current = false;
      setSubmitting(false);
      if (!e?._handled) Alert.alert(editing ? '저장하지 못했어요' : '등록하지 못했어요', e?.message ?? '잠시 후 다시 시도해 주세요.');
    }
  };

  const contentWidth = width - insets.left - insets.right - SIDE * 2;
  const photoLabel = leader ? '소개 이미지' : '사진';
  const submitLabel = !editing ? (leader ? '등록 요청' : '투어 등록') : resubmit ? '보완 후 재요청' : editState?.isPublic && leader ? '수정 요청' : '수정 저장';

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <TourHeader title={editing ? '투어 수정' : '투어 등록'} onBack={() => router.back()} />
      {loading ? (
        <View style={styles.loading}><ActivityIndicator size="large" color="rgba(255,255,255,0.5)" /></View>
      ) : (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" scrollEnabled={!dragging}>
          {editState?.reviewNote ? (
            <View style={fs.reviewNote}>
              <Text style={fs.reviewNoteTitle}>관리자 보완 요청</Text>
              <Text style={fs.reviewNoteText}>{editState.reviewNote}</Text>
            </View>
          ) : null}

          {/* 등록 역할: 강사 · admin에게만 보임 (일반 사용자는 참여자로만) */}
          {!editing && canLead ? (
            <View style={styles.roles}>
              {(['PARTICIPANT', 'LEADER'] as const).map(role => (
                <Pressable key={role} accessibilityRole="button" accessibilityState={{ selected: form.role === role }} onPress={() => chooseRole(role)}
                  style={[styles.role, form.role === role && styles.roleOn]}>
                  <Text style={[styles.roleText, form.role === role && styles.roleTextOn]}>{role === 'PARTICIPANT' ? '참여자' : '인솔자'}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {!editing && !leader ? (
            <View style={fs.box}>
              <Text style={fs.boxText}>
                다이빙 여행, <Text style={styles.em}>함께 갈 사람</Text>을 모으고 전문 투어 강사님께 <Text style={styles.em}>인솔 제안</Text>을 받아 보세요!
                {'\n'}등록 · 제안은 모두 <Text style={styles.free}>무료</Text>예요.
              </Text>
            </View>
          ) : null}

          <FieldLabel text={photoLabel} required={leader} note={`${leader ? '' : '선택 · '}최대 ${L.imageMax}장 · 눌러서 대표 선택`} error={shown('images')} />
          <TourImageGrid
            images={form.images} max={L.imageMax} width={contentWidth} error={!!shown('images')} label={photoLabel}
            coverIndex={Math.max(0, form.images.findIndex(i => i.uri === form.coverUri))}
            onCover={index => update('coverUri', form.images[index]?.uri ?? '')}
            onAdd={addPhotos}
            onRemove={index => { touch('images'); setForm(prev => ({ ...prev, ...removePhoto(prev.images, prev.coverUri, index) })); }}
            onMove={(from, to) => update('images', moveItem(form.images, from, to))}
            onDragChange={setDragging}
          />
          <Text style={fs.guide}>{leader ? '투어 소개는 이미지로 올려 주세요. 일정 · 준비물 · 자격 조건을 담아 주세요.' : '대표 사진이 목록 카드에 크게 보여요. 사진을 누르면 대표 사진으로 바뀌어요.'}</Text>

          {leader ? (
            <>
              <FieldLabel text="투어명" required error={shown('title')} />
              <TextInput style={[fs.input, shown('title') && fs.inputError]} value={form.title} onChangeText={text => update('title', text)} onBlur={() => touch('title')}
                placeholder="예) 세부 펀다이빙 3박 4일" placeholderTextColor="rgba(255,255,255,0.25)" maxLength={L.titleMax} returnKeyType="done" />
            </>
          ) : null}

          <FieldLabel text="기간" required error={shown('period')} />
          <View style={fs.row}>
            <Selector label={form.startDate.replace(/-/g, '.') || '시작일'} placeholder={!form.startDate} error={!!shown('period')} icon="calendar-outline" onPress={() => setSheet('start')} />
            <Text style={fs.tilde}>~</Text>
            <Selector label={form.endDate.replace(/-/g, '.') || '종료일'} placeholder={!form.endDate} error={!!shown('period')} icon="calendar-outline" onPress={() => setSheet('end')} />
          </View>

          <FieldLabel text="지역" required error={shown('region')} />
          <View style={fs.row}>
            <Selector label={regionName(continents, form.continentCode) || '대륙 선택'} placeholder={!form.continentCode} error={!!shown('region') && !form.continentCode}
              onPress={() => (regionsFailed ? loadRegions() : setSheet('continent'))} />
            <Selector label={regionName(countries, form.countryCode) || '나라 선택'} placeholder={!form.countryCode} disabled={!form.continentCode}
              error={!!shown('region') && !!form.continentCode && !form.countryCode} onPress={() => setSheet('country')} />
          </View>
          {regionsFailed ? <Text style={fs.retry}>지역 목록을 불러오지 못했어요. 대륙 선택을 다시 눌러 주세요.</Text> : null}

          <FieldLabel text="투어 장소" required error={shown('place')} />
          <TextInput style={[fs.input, shown('place') && fs.inputError]} value={form.place} onChangeText={text => update('place', text)} onBlur={() => touch('place')}
            placeholder="예) 세부" placeholderTextColor="rgba(255,255,255,0.25)" maxLength={L.placeMax} returnKeyType="done" />

          <View style={fs.row}>
            <View style={fs.half}>
              <FieldLabel text="총 인원" required />
            </View>
            <View style={fs.half}>
              <FieldLabel text={leader ? '지금 모인 인원 (인솔자 빼고)' : '지금 모인 인원 (나 포함)'} required />
            </View>
          </View>
          <View style={fs.row}>
            <Stepper label="총 인원" value={form.capacity} min={Math.max(L.capacityMin, form.baseCount + (editState?.joinedCount ?? 0))} max={L.capacityMax}
              onChange={v => { touch('counts'); update('capacity', v); }} />
            <Stepper label="지금 모인 인원" value={form.baseCount} min={baseMin(form.role)} max={form.capacity - (editState?.joinedCount ?? 0)}
              error={!!shown('counts')} onChange={v => { touch('counts'); update('baseCount', v); }} />
          </View>
          {shown('counts') ? <Text style={fs.retry}>{errors.counts}</Text> : <Text style={fs.hint}>{editing && editState?.joinedCount ? `수락한 참여자 ${editState.joinedCount}명 포함 · ` : ''}{outcomeText}</Text>}

          <FieldLabel text="투어 형태" required error={shown('style')} />
          <Chips options={STYLE_OPTIONS} value={form.tourStyle} error={!!shown('style')} onChange={v => { touch('style'); update('tourStyle', v); }} />

          {leader ? (
            <>
              <FieldLabel text="참가비 (1인)" />
              <Suffixed suffix="원">
                <TextInput style={fs.suffixedInput} value={feeDigits(form.fee)} onChangeText={text => update('fee', digitsOnly(text).slice(0, 10))}
                  placeholder="예) 1,200,000" placeholderTextColor="rgba(255,255,255,0.25)" keyboardType="number-pad" />
              </Suffixed>
              <ItemList title="포함 사항" mark="✓" items={form.included} onChange={items => update('included', items)} />
              <ItemList title="불포함 사항" mark="✕" items={form.excluded} onChange={items => update('excluded', items)} />
              <LinkList links={form.links} error={shown('links')}
                onRemove={index => { touch('links'); update('links', form.links.filter((_, i) => i !== index)); }} onAdd={() => setAddingLink(true)} />
            </>
          ) : null}

          {!editing && !leader ? (
            <Text style={[fs.guide, blockedToday && styles.blocked]}>
              {blockedToday ? '오늘은 이미 참여자로 등록했어요. 내일 다시 등록할 수 있어요.' : '참여자로 등록은 하루에 한 번 할 수 있어요.'}
            </Text>
          ) : null}
        </ScrollView>

        <View style={styles.bottomArea}>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: !valid || submitting || blockedToday }}
            style={({ pressed }) => [styles.submitButton, glassClear, pressed && { opacity: 0.85 }, (!valid || submitting || blockedToday) && { opacity: 0.45 }]}
            onPress={confirmAndSubmit} disabled={!valid || submitting || blockedToday}>
            <GlassBackground radius={14} interactive tintColor={PROMINENT_TINT} />
            {submitting ? <ActivityIndicator color={Colors.brand.primary} /> : <Text style={styles.submitText}>{submitLabel}</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      )}

      <TourLinkPopup visible={addingLink} onClose={() => setAddingLink(false)}
        onAdd={link => { setAddingLink(false); touch('links'); setForm(prev => ({ ...prev, links: [...prev.links, link].slice(0, L.linkMax) })); }} />
      <BottomSheet visible={sheet === 'continent'} onClose={() => { setSheet(null); touch('region'); }} title="대륙"
        items={continents.map(c => ({ label: c.nameKo ?? c.name, value: c.code }))} selectedValue={form.continentCode} fitContent
        onSelect={code => { if (code !== form.continentCode) setForm(prev => ({ ...prev, continentCode: code, countryCode: '' })); }} />
      <BottomSheet visible={sheet === 'country'} onClose={() => { setSheet(null); touch('region'); }} title={`나라 (${regionName(continents, form.continentCode)})`}
        items={countriesOf(form.continentCode).map(c => ({ label: c.nameKo ?? c.name, value: c.code }))} selectedValue={form.countryCode}
        searchable={countriesOf(form.continentCode).length > 8} onSelect={code => update('countryCode', code)} />
      <DatePickerSheet visible={sheet === 'start'} onClose={() => { setSheet(null); touch('period'); }} selectedDate={form.startDate} minDate={today}
        onSelect={date => setForm(prev => ({ ...prev, startDate: date, endDate: prev.endDate && prev.endDate >= date ? prev.endDate : date }))} />
      <DatePickerSheet visible={sheet === 'end'} onClose={() => { setSheet(null); touch('period'); }} selectedDate={form.endDate || form.startDate}
        minDate={form.startDate || today} onSelect={date => update('endDate', date)} />
      <UploadProgressPopup {...uploads.popup} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.brand.primary },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: SIDE, paddingTop: 8, paddingBottom: 24 },
  roles: { flexDirection: 'row', padding: 3, borderRadius: 12, backgroundColor: 'rgba(2,62,115,0.9)', marginTop: 8 },
  role: { flex: 1, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  roleOn: { backgroundColor: '#00B4D8' },
  roleText: { fontFamily: 'SUIT-Bold', fontSize: 14, color: '#B8D4F0' },
  roleTextOn: { color: '#FFFFFF' },
  em: { fontFamily: 'SUIT-Bold', color: '#00E5FF' },
  free: { fontFamily: 'SUIT-Bold', color: '#FFD166' },
  blocked: { color: '#FFB4A2' },
  bottomArea: { paddingHorizontal: SIDE, paddingVertical: 12 },
  submitButton: { height: 54, borderRadius: 14, backgroundColor: Colors.brand.white, alignItems: 'center', justifyContent: 'center' },
  submitText: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.primary },
});
