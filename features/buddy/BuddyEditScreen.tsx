import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/Colors';
import { api } from '@/services/api';
import BottomSheet from '@/components/BottomSheet';
import DatePickerSheet from '@/components/DatePickerSheet';
import Spinner from '@/components/Spinner';
import GlassCircle from '@/components/GlassCircle';
import GlassBackground, { glassClear } from '@/components/GlassBackground';
import StripBackSlot from '@/components/StripBackSlot';
import { styles } from '@/features/schedule/styles';
import { DoneCard, EnteringCard, StepBadge, flowStyles } from '@/features/schedule/EditorFlow';
import { CUSTOM_LOCATION_POOL, HOURS, MINUTES, type Pool } from '@/features/schedule/useScheduleEditor';

// 캘린더 '버디 찾기' 만들기 · 수정 (2026-11-23): 다이빙 만들기와 같은 한 항목씩 입력하는 흐름.
// 제목 → 장소 → 날짜 → 시간 → 찾는 인원 → 내용(선택) → 올리기
type Key = 'title' | 'place' | 'date' | 'time' | 'members' | 'content';
const ORDER: Key[] = ['title', 'place', 'date', 'time', 'members', 'content'];
const LABELS: Record<Key, string> = { title: '제목', place: '장소', date: '날짜', time: '시간', members: '찾는 인원', content: '내용 (선택)' };
const PROMINENT_TINT = 'rgba(255,255,255,0.85)';

export default function BuddyEditScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, date } = useLocalSearchParams<{ id?: string; date?: string }>();
  const isEdit = !!id;

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const [title, setTitle] = useState('');
  const [pools, setPools] = useState<Pool[]>([]);
  const [pool, setPool] = useState<Pool | null>(null);
  const [customLocation, setCustomLocation] = useState('');
  const [diveDate, setDiveDate] = useState(date || todayStr);
  const [hour, setHour] = useState(10);
  const [minute, setMinute] = useState(0);
  const [members, setMembers] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState<'pool' | 'date' | 'hour' | 'minute' | null>(null);

  const [active, setActive] = useState<Key>('title');
  const [done, setDone] = useState<Set<Key>>(new Set());
  const isDone = (k: Key) => isEdit || done.has(k);
  const isCustom = pool?.id === CUSTOM_LOCATION_POOL.id;

  useEffect(() => {
    let alive = true;
    api.getDivingPools().then((res) => {
      if (!alive) return;
      const list = (res.pools ?? []).sort((a, b) => a.id - b.id);
      setPools(list);
      if (!isEdit) return;
      api.getBuddyPost(Number(id)).then(({ post }) => {
        if (!alive) return;
        setTitle(post.title); setDiveDate(post.diveDate); setHour(post.startHour); setMinute(post.startMinute);
        setMembers(String(post.maxMembers)); setContent(post.content ?? '');
        if (post.customLocation) { setPool(CUSTOM_LOCATION_POOL); setCustomLocation(post.customLocation); }
        else setPool(list.find((p) => p.id === post.poolId) ?? null);
      }).catch(() => Alert.alert('오류', '모집 글을 불러오지 못했어요.')).finally(() => { if (alive) setLoading(false); });
    }).catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id, isEdit]);

  const validate = (k: Key) => {
    if (k === 'title' && !title.trim()) return '제목을 입력해주세요.';
    if (k === 'place' && isCustom && !customLocation.trim()) return '어디에서 다이빙하는지 입력해주세요.';
    if (k === 'members' && !(Number(members) >= 1)) return '찾는 인원을 1명 이상 넣어 주세요.';
    return null;
  };

  const save = () => {
    for (const k of ORDER) { const m = validate(k); if (m) { setActive(k); Alert.alert('알림', m); return; } }
    const d = new Date(`${diveDate}T00:00:00`);
    const place = isCustom ? customLocation.trim() : pool?.name;
    Alert.alert(isEdit ? '버디 찾기를 고칠까요?' : '버디 찾기를 올릴까요?',
      `${title.trim()}\n${d.getMonth() + 1}월 ${d.getDate()}일 ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}${place ? ` · ${place}` : ''}\n찾는 인원 ${members}명`, [
        { text: '취소', style: 'cancel' },
        { text: isEdit ? '고칠게요' : '올릴게요', onPress: async () => {
          const data = {
            title: title.trim(), diveDate, startHour: hour, startMinute: minute,
            poolId: isCustom ? null : pool?.id ?? null, customLocation: isCustom ? customLocation.trim() : null,
            maxMembers: Number(members), content: content.trim() || null,
          };
          setSaving(true);
          try {
            if (isEdit) { await api.updateBuddyPost(Number(id), data); router.back(); }
            else {
              const res = await api.createBuddyPost(data);
              router.back();
              setTimeout(() => router.push({ pathname: '/buddy-detail', params: { id: String(res.id) } }), 100);
            }
          } catch (e: any) {
            if (!e._handled) Alert.alert(isEdit ? '수정 실패' : '등록 실패', e.message ?? '잠시 후 다시 시도해주세요.');
          } finally { setSaving(false); }
        } },
      ]);
  };

  const next = () => {
    const m = validate(active);
    if (m) { Alert.alert('알림', m); return; }
    const nextDone = new Set(done).add(active);
    setDone(nextDone);
    const following = ORDER.slice(ORDER.indexOf(active) + 1).find((k) => !(isEdit || nextDone.has(k)));
    if (following) setActive(following);
    else save();
  };
  // 고르면 끝나는 장소 · 날짜는 반영된 다음 넘어감
  const [tick, setTick] = useState(0);
  useEffect(() => { if (!tick) return; const t = setTimeout(next, 220); return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tick]);

  const d = new Date(`${diveDate}T00:00:00`);
  const valueOf = (k: Key) => ({
    title: title.trim() || '-',
    place: (isCustom ? customLocation.trim() : pool?.name) || '선택 안 함',
    date: `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`,
    time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    members: members ? `${members}명` : '-',
    content: content.trim() || '없음',
  }[k]);
  const isLast = ORDER.slice(ORDER.indexOf(active) + 1).every((k) => isDone(k));

  const field = () => {
    switch (active) {
      case 'title': return (
        <TextInput style={styles.input} value={title} onChangeText={setTitle} autoFocus={!isEdit} maxLength={100}
          placeholder="예: 토요일 아침 펀다이빙 같이 가요" placeholderTextColor="rgba(255,255,255,0.25)"
          returnKeyType="next" submitBehavior="submit" onSubmitEditing={next} />
      );
      case 'place': return (
        <>
          <Pressable style={styles.pickerButton} onPress={() => { Keyboard.dismiss(); setPicker('pool'); }}>
            <Text style={[styles.pickerText, !pool && styles.pickerPlaceholder]}>{pool?.name ?? '장소를 선택해주세요'}</Text>
            <Text style={styles.pickerArrow}>▼</Text>
          </Pressable>
          {isCustom && (
            <TextInput style={[styles.input, { marginTop: 8 }]} value={customLocation} onChangeText={setCustomLocation} autoFocus maxLength={100}
              placeholder="어디에서 다이빙하나요? (예: 제주 서귀포 문섬)" placeholderTextColor="rgba(255,255,255,0.25)"
              returnKeyType="next" submitBehavior="submit" onSubmitEditing={next} />
          )}
        </>
      );
      case 'date': return (
        <Pressable style={styles.dateInputRow} onPress={() => { Keyboard.dismiss(); setPicker('date'); }}>
          <Text style={styles.pickerText}>{d.getFullYear()}년 {d.getMonth() + 1}월 {d.getDate()}일</Text>
          <Text style={styles.calendarIcon}>📅</Text>
        </Pressable>
      );
      case 'time': return (
        <View style={styles.timeRow}>
          <Pressable style={styles.timePickerButton} onPress={() => setPicker('hour')}>
            <Text style={styles.pickerText}>{String(hour).padStart(2, '0')}</Text><Text style={styles.pickerArrow}>▼</Text>
          </Pressable>
          <Text style={styles.timeLabel}>시</Text>
          <Pressable style={styles.timePickerButton} onPress={() => setPicker('minute')}>
            <Text style={styles.pickerText}>{String(minute).padStart(2, '0')}</Text><Text style={styles.pickerArrow}>▼</Text>
          </Pressable>
          <Text style={styles.timeLabel}>분</Text>
        </View>
      );
      case 'members': return (
        <>
          <View style={styles.trainingRow}>
            <TextInput style={[styles.input, styles.trainingInput]} value={members} autoFocus keyboardType="number-pad" maxLength={2}
              onChangeText={(t) => setMembers(t.replace(/\D/g, '').replace(/^0+/, ''))}
              placeholder="예: 3" placeholderTextColor="rgba(255,255,255,0.25)" accessibilityLabel="찾는 인원" />
            <Text style={styles.timeLabel}>명</Text>
          </View>
          <Text style={flowStyles.hint}>나를 빼고 함께할 사람 수예요. 승인한 사람이 이만큼 모이면 모집이 마감되고 다이빙 일정이 만들어져요.</Text>
        </>
      );
      case 'content': return (
        <TextInput style={[styles.input, { minHeight: 110, textAlignVertical: 'top' }]} value={content} onChangeText={setContent} autoFocus multiline maxLength={1000}
          placeholder="어떤 버디를 찾는지 적어 주세요. (예: 수심 20m 이상, 매주 같이 다닐 분)" placeholderTextColor="rgba(255,255,255,0.25)" />
      );
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <StripBackSlot size={36}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}>
            <GlassCircle fallbackStyle={styles.backCircle}><Text style={styles.backArrow}>{'<'}</Text></GlassCircle>
          </Pressable>
        </StripBackSlot>
        <Text style={styles.headerTitle}>{isEdit ? '버디 찾기 수정' : '버디 찾기 만들기'}</Text>
        <View style={{ width: 36 }} />
      </View>
      {loading ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Spinner /></View> : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
            <EnteringCard key={`active-${active}`} style={flowStyles.card}>
              <View style={flowStyles.cardHeader}>
                <Text style={flowStyles.cardTitle}>{LABELS[active]}</Text>
                <StepBadge index={ORDER.indexOf(active) + 1} total={ORDER.length} />
              </View>
              {field()}
            </EnteringCard>
            {ORDER.filter((k) => k !== active && isDone(k)).reverse().map((k) => (
              <DoneCard key={`done-${k}`} label={LABELS[k]} value={valueOf(k)} index={ORDER.indexOf(k) + 1} total={ORDER.length} onPress={() => setActive(k)} />
            ))}
          </ScrollView>
          <View style={styles.bottomArea}>
            <Pressable style={({ pressed }) => [styles.primaryButton, glassClear, pressed && { opacity: 0.85 }]} onPress={isLast ? save : next} disabled={saving}>
              <GlassBackground radius={14} interactive tintColor={PROMINENT_TINT} />
              {saving ? <ActivityIndicator color={Colors.brand.primary} />
                : <Text style={styles.primaryButtonText}>{isLast ? (isEdit ? '수정하기' : '모집 올리기') : '다음'}</Text>}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}

      <DatePickerSheet visible={picker === 'date'} onClose={() => setPicker(null)} selectedDate={diveDate}
        onSelect={(v) => { setDiveDate(v); if (active === 'date') setTick((t) => t + 1); }} />
      <BottomSheet visible={picker === 'pool'} onClose={() => setPicker(null)} title="장소 선택"
        items={pools.map((p) => ({ label: p.name, value: p }))}
        pinnedItems={[{ label: CUSTOM_LOCATION_POOL.name, value: CUSTOM_LOCATION_POOL }]}
        onSelect={(v) => { setPool(v); if (active === 'place' && v.id !== CUSTOM_LOCATION_POOL.id) setTick((t) => t + 1); }} selectedValue={pool} searchable />
      <BottomSheet visible={picker === 'hour'} onClose={() => setPicker(null)} title="시"
        items={HOURS.map((h) => ({ label: `${String(h).padStart(2, '0')}시`, value: h }))} onSelect={(v) => setHour(v)} selectedValue={hour} />
      <BottomSheet visible={picker === 'minute'} onClose={() => setPicker(null)} title="분"
        items={MINUTES.map((m) => ({ label: `${String(m).padStart(2, '0')}분`, value: m }))} onSelect={(v) => setMinute(v)} selectedValue={minute} />
    </View>
  );
}
