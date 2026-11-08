import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Pressable, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, useWindowDimensions, DeviceEventEmitter,
} from 'react-native';
import { useLocalSearchParams, useRouter, usePreventRemove } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/Colors';
import { api } from '@/services/api';
import GlassBackground, { glassClear } from '@/components/GlassBackground';
import { UploadProgressPopup, useUploadProgress } from '@/components/UploadProgress';
import TourImageGrid from './TourImageGrid';
import TourLinkPopup from './TourLinkPopup';
import { pickPhotos, removePhoto, uploadPhotos } from './photos';
import { FieldLabel, formStyles as fs, ItemList, LinkList, SIDE, Suffixed, TourHeader } from './FormParts';
import {
  EMPTY_PROPOSAL_FORM, ProposalField, ProposalForm, TOUR_FORM_LIMITS as L, digitsOnly, feeDigits, isDirty, moveItem, proposalErrors, proposalFormFrom, toProposalInput,
} from './tourForm';
import { STYLE_LABEL, formatTourPeriod } from './ui';
import { TOURS_CHANGED } from './nav';

const PROMINENT_TINT = 'rgba(255,255,255,0.85)';

// 8장 제안하기 (강사 · admin): 인솔자 모집중 투어에 인솔 정보(인솔자로 등록과 같은 칸) + 한마디. ?proposalId=면 제안 수정
export default function TourProposeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { id, proposalId } = useLocalSearchParams<{ id?: string; proposalId?: string }>();
  const editing = !!proposalId;
  const [form, setForm] = useState<ProposalForm>(EMPTY_PROPOSAL_FORM);
  const [initial, setInitial] = useState<ProposalForm>(EMPTY_PROPOSAL_FORM);
  const [summary, setSummary] = useState<{ title: string; meta: string } | null>(null);
  const [tourId, setTourId] = useState<number | null>(id ? Number(id) : null);
  const [loading, setLoading] = useState(true);
  const [touched, setTouched] = useState<Partial<Record<ProposalField, boolean>>>({});
  const [dragging, setDragging] = useState(false);
  const [addingLink, setAddingLink] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const uploads = useUploadProgress();

  const update = <K extends keyof ProposalForm>(key: K, value: ProposalForm[K]) => setForm(prev => ({ ...prev, [key]: value }));
  const touch = (field: ProposalField) => setTouched(prev => (prev[field] ? prev : { ...prev, [field]: true }));
  const errors = useMemo(() => proposalErrors(form), [form]);
  const shown = (field: ProposalField) => (touched[field] ? errors[field] : undefined);
  const valid = Object.keys(errors).length === 0;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let target = tourId;
        if (editing) {
          const p = await api.getTourProposal(Number(proposalId));
          if (!alive) return;
          const loaded = proposalFormFrom(p);
          setForm(loaded); setInitial(loaded); target = p.tourId; setTourId(p.tourId);
          setTouched({ images: true, title: true, fee: true, links: true });
        } else {
          // 새 제안의 문의 링크는 빈 채로 시작 (프로필 링크와 연동 안 함)
          touch('links');
        }
        if (target) {
          const { tour, registrant } = await api.getTour(target);
          if (!alive) return;
          setSummary({ title: tour.name, meta: `${formatTourPeriod(tour.startDate, tour.endDate)} · ${tour.count}명 · ${STYLE_LABEL[tour.tourStyle]} · 등록 ${registrant.nickname}` });
        }
      } catch (e: any) {
        if (!alive) return;
        Alert.alert('제안 화면을 열지 못했어요', e?.message, [{ text: '확인', onPress: () => router.back() }]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const submit = async () => {
    if (!valid || submittingRef.current || !tourId) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const input = toProposalInput(form, await uploadPhotos(form.images, uploads.run, '소개 이미지'));
      if (editing) await api.updateTourProposal(Number(proposalId), input);
      else await api.proposeTour(tourId, input);
      disablePrevention();
      DeviceEventEmitter.emit(TOURS_CHANGED);
      Alert.alert(editing ? '제안을 고쳤어요' : '제안을 보냈어요', editing ? '등록자의 받은 제안 목록에 바로 반영했어요.' : '등록자에게 알렸어요. 승낙 전까지 고치거나 취소할 수 있어요.',
        [{ text: '확인', onPress: () => router.back() }]);
    } catch (e: any) {
      submittingRef.current = false;
      setSubmitting(false);
      if (!e?._handled) Alert.alert(editing ? '저장하지 못했어요' : '제안을 보내지 못했어요', e?.message ?? '잠시 후 다시 시도해 주세요.');
    }
  };

  const contentWidth = width - insets.left - insets.right - SIDE * 2;

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <TourHeader title={editing ? '제안 수정' : '제안하기'} onBack={() => router.back()} />
      {loading ? (
        <View style={styles.loading}><ActivityIndicator size="large" color="rgba(255,255,255,0.5)" /></View>
      ) : (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" scrollEnabled={!dragging}>
          {summary ? (
            <View style={fs.box}>
              <Text style={styles.summaryTitle}>{summary.title}</Text>
              <Text style={fs.boxText}>{summary.meta}</Text>
            </View>
          ) : null}

          <FieldLabel text="소개 이미지" required note={`최대 ${L.imageMax}장 · 눌러서 대표 선택`} error={shown('images')} />
          <TourImageGrid
            images={form.images} max={L.imageMax} width={contentWidth} error={!!shown('images')} label="소개 이미지"
            coverIndex={Math.max(0, form.images.findIndex(i => i.uri === form.coverUri))}
            onCover={index => update('coverUri', form.images[index]?.uri ?? '')}
            onAdd={addPhotos}
            onRemove={index => { touch('images'); setForm(prev => ({ ...prev, ...removePhoto(prev.images, prev.coverUri, index) })); }}
            onMove={(from, to) => update('images', moveItem(form.images, from, to))}
            onDragChange={setDragging}
          />
          <Text style={fs.guide}>일정 · 준비물 · 자격 조건을 이미지로 담아 주세요. 승낙되면 이 사진이 투어 사진이 돼요.</Text>

          <FieldLabel text="투어명" required error={shown('title')} />
          <TextInput style={[fs.input, shown('title') && fs.inputError]} value={form.title} onChangeText={text => update('title', text)} onBlur={() => touch('title')}
            placeholder="예) 보홀 펀다이빙 4박 5일" placeholderTextColor="rgba(255,255,255,0.25)" maxLength={L.titleMax} returnKeyType="done" />

          <FieldLabel text="참가비 (1인)" required error={shown('fee')} />
          <Suffixed suffix="원" error={!!shown('fee')}>
            <TextInput style={fs.suffixedInput} value={feeDigits(form.fee)} onChangeText={text => update('fee', digitsOnly(text).slice(0, 10))} onBlur={() => touch('fee')}
              placeholder="예) 1,200,000" placeholderTextColor="rgba(255,255,255,0.25)" keyboardType="number-pad" />
          </Suffixed>

          <LinkList links={form.links} error={shown('links')}
            onRemove={index => { touch('links'); update('links', form.links.filter((_, i) => i !== index)); }} onAdd={() => setAddingLink(true)} />
          <ItemList title="포함 사항" mark="✓" items={form.included} onChange={items => update('included', items)} />
          <ItemList title="불포함 사항" mark="✕" items={form.excluded} onChange={items => update('excluded', items)} />

          <FieldLabel text="한마디 (등록자에게 · 선택)" note={`${form.message.trim().length}/${L.proposalMessageMax}`} error={shown('message')} />
          <TextInput style={[fs.input, fs.textArea]} value={form.message} onChangeText={text => { touch('message'); update('message', text); }} multiline
            maxLength={L.proposalMessageMax} placeholder="예) 보홀에서 10년째 투어를 진행하고 있어요." placeholderTextColor="rgba(255,255,255,0.25)" />
          <Text style={fs.guide}>보내면 등록자에게 알림이 가요. 제안 내용은 등록자만 볼 수 있어요.</Text>
        </ScrollView>

        <View style={styles.bottomArea}>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: !valid || submitting }}
            style={({ pressed }) => [styles.submitButton, glassClear, pressed && { opacity: 0.85 }, (!valid || submitting) && { opacity: 0.45 }]}
            onPress={submit} disabled={!valid || submitting}>
            <GlassBackground radius={14} interactive tintColor={PROMINENT_TINT} />
            {submitting ? <ActivityIndicator color={Colors.brand.primary} /> : <Text style={styles.submitText}>{editing ? '수정 저장' : '제안 보내기'}</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      )}
      <TourLinkPopup visible={addingLink} onClose={() => setAddingLink(false)}
        onAdd={link => { setAddingLink(false); touch('links'); setForm(prev => ({ ...prev, links: [...prev.links, link].slice(0, L.linkMax) })); }} />
      <UploadProgressPopup {...uploads.popup} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.brand.primary },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: SIDE, paddingTop: 8, paddingBottom: 24 },
  summaryTitle: { fontFamily: 'SUIT-Bold', fontSize: 15, color: Colors.brand.white },
  bottomArea: { paddingHorizontal: SIDE, paddingVertical: 12 },
  submitButton: { height: 54, borderRadius: 14, backgroundColor: Colors.brand.white, alignItems: 'center', justifyContent: 'center' },
  submitText: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.primary },
});
