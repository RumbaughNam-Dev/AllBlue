import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { api } from '@/services/api';
import BottomSheet from '@/components/BottomSheet';
import DatePickerSheet from '@/components/DatePickerSheet';
import GlassBackground, { glassClear } from '@/components/GlassBackground';
import GlassCircle from '@/components/GlassCircle';
import StripBackSlot from '@/components/StripBackSlot';
import { useAppRouter } from '@/features/split/SplitPane';
import { Buttons, Popup } from './TourManagePopups';
import { localToday } from './tourForm';
import { regionName, useTourRegions } from './useTourRegions';

const SIDE = 20;
const ACCENT = '#00E5FF';
const FREE = '#FFD166';
const PROMINENT_TINT = 'rgba(255,255,255,0.85)';
type Sheet = 'continent' | 'country' | 'from' | 'to' | null;
type Draft = { continent: string; country: string; from: string; to: string; headcount: number };
// 참여 인원: 나를 포함해 1~20명, 처음엔 나 혼자(1명)
const HEADCOUNT_MIN = 1, HEADCOUNT_MAX = 20;
const EMPTY: Draft = { continent: '', country: '', from: '', to: '', headcount: HEADCOUNT_MIN };
const dot = (day: string) => day.replace(/-/g, '.');

// 투어 역제안 ('투어 가고 싶어요'): 누구나 기간 · 지역 · 참여 인원만 정해 강사님들께 알림. 하루에 한 번
export default function TourWishScreen() {
  const router = useAppRouter();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  // 오늘 이미 보냈는지 (불러오기 전엔 null)
  const [sentToday, setSentToday] = useState<boolean | null>(null);
  const { continents, countries, failed, reload, countriesOf } = useTourRegions();
  const today = localToday();

  useEffect(() => {
    let active = true;
    api.getTourWishStatus()
      .then(res => { if (active) setSentToday(res.sentToday); })
      .catch(() => { if (active) setSentToday(false); }); // 서버가 다시 확인함
    return () => { active = false; };
  }, []);

  const set = (patch: Partial<Draft>) => setDraft(prev => ({ ...prev, ...patch }));
  const filled = !!(draft.continent && draft.country && draft.from && draft.to);
  const canSend = filled && sentToday === false;
  const place = draft.country ? `${regionName(continents, draft.continent)} · ${regionName(countries, draft.country)}` : '';
  const period = draft.from && draft.to ? (draft.from === draft.to ? dot(draft.from) : `${dot(draft.from)} ~ ${dot(draft.to)}`) : '';

  const continentItems = continents.map(c => ({ label: c.nameKo ?? c.name, value: c.code }));
  const countryItems = countriesOf(draft.continent).map(c => ({ label: c.nameKo ?? c.name, value: c.code }));

  const send = async () => {
    if (!canSend || sendingRef.current) return;
    sendingRef.current = true; // 두 번 눌러도 한 번만
    setSending(true);
    try {
      await api.createTourWish({ continentCode: draft.continent, countryCode: draft.country, startDate: draft.from, endDate: draft.to, headcount: draft.headcount });
      setConfirming(false);
      router.back(); // 투어 홈으로
    } catch (e: any) {
      setConfirming(false);
      if (e?.code === 'ALREADY') setSentToday(true);
      if (!e?._handled) Alert.alert('알림', e?.message ?? '보내지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

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
        <Text style={styles.headerTitle}>투어 가고 싶어요</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* 이 기능 안내 */}
        <View style={styles.intro}>
          <View style={styles.introBadge}>
            <Ionicons name="sparkles" size={13} color={ACCENT} />
            <Text style={styles.introBadgeText}>투어 역제안</Text>
          </View>

          <IntroLine icon="airplane-outline">
            다이빙 여행을 가고 싶은데 <Text style={styles.point}>망설여지나요?</Text>
          </IntroLine>
          <IntroLine icon="wallet-outline">
            <Text style={styles.point}>비용</Text>이 걱정되시나요?
          </IntroLine>
          <IntroLine icon="compass-outline">
            막상 알아보려니 <Text style={styles.point}>어디서부터</Text> 알아봐야 할지 막막하시죠?
          </IntroLine>

          <View style={styles.divider} />

          <IntroLine icon="paper-plane-outline">
            <Text style={styles.point}>전문 투어 강사님</Text>들께 <Text style={styles.point}>기간 · 지역 · 인원</Text>만 정해서 투어를 제안해 보세요!
          </IntroLine>
          <IntroLine icon="notifications-outline">
            제안하면 강사님들께 <Text style={styles.point}>투어 제안 알림</Text>이 바로 가요.
          </IntroLine>

          <View style={styles.free}>
            <Ionicons name="gift-outline" size={18} color={FREE} />
            <Text style={styles.freeText}>요금은 <Text style={styles.freePoint}>무료</Text>예요!</Text>
          </View>
        </View>

        {/* 입력: 기간 · 지역 (투어 만들기와 같은 규칙) */}
        <Text style={styles.label}><Ionicons name="calendar-outline" size={14} color={ACCENT} />  언제 가고 싶나요?</Text>
        <View style={styles.row}>
          <Selector label={draft.from ? dot(draft.from) : '시작일'} placeholder={!draft.from} icon="calendar-outline" onPress={() => setSheet('from')} />
          <Text style={styles.tilde}>~</Text>
          <Selector label={draft.to ? dot(draft.to) : '종료일'} placeholder={!draft.to} icon="calendar-outline" onPress={() => setSheet('to')} />
        </View>

        <Text style={styles.label}><Ionicons name="location-outline" size={14} color={ACCENT} />  어디로 가고 싶나요?</Text>
        <View style={styles.row}>
          <Selector label={draft.continent ? regionName(continents, draft.continent) : '대륙'} placeholder={!draft.continent} onPress={() => (failed ? reload() : setSheet('continent'))} />
          {/* 대륙을 고르기 전까지 나라는 비활성 */}
          <Selector label={draft.country ? regionName(countries, draft.country) : '나라'} placeholder={!draft.country} disabled={!draft.continent} onPress={() => setSheet('country')} />
        </View>

        <Text style={styles.label}><Ionicons name="people-outline" size={14} color={ACCENT} />  몇 명이 함께 가나요?</Text>
        <View style={styles.headcount}>
          <StepButton icon="remove" label="한 명 빼기" disabled={draft.headcount <= HEADCOUNT_MIN} onPress={() => set({ headcount: draft.headcount - 1 })} />
          <Text style={styles.headcountValue} accessibilityLiveRegion="polite">
            <Text style={styles.headcountNumber}>{draft.headcount}</Text>명
          </Text>
          <StepButton icon="add" label="한 명 더하기" disabled={draft.headcount >= HEADCOUNT_MAX} onPress={() => set({ headcount: draft.headcount + 1 })} />
        </View>
        <Text style={styles.headcountHint}>나를 포함한 인원이에요 (최대 {HEADCOUNT_MAX}명)</Text>

        {sentToday ? (
          <View style={styles.sentNotice}>
            <Ionicons name="time-outline" size={16} color={FREE} />
            <Text style={styles.sentNoticeText}>오늘은 이미 투어 역제안을 보냈어요. 내일 다시 보낼 수 있어요.</Text>
          </View>
        ) : (
          <Text style={styles.hint}>투어 역제안은 하루에 한 번 보낼 수 있어요.</Text>
        )}
      </ScrollView>

      {/* 하단 고정 버튼 */}
      <View style={styles.bottomArea}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSend }}
          disabled={!canSend}
          onPress={() => setConfirming(true)}
          style={({ pressed }) => [styles.submitButton, glassClear, pressed && { opacity: 0.85 }, !canSend && { opacity: 0.45 }]}
        >
          <GlassBackground radius={14} interactive tintColor={PROMINENT_TINT} />
          {sentToday == null ? <ActivityIndicator color={Colors.brand.primary} /> : (
            <View style={styles.submitContent}>
              <Ionicons name="hand-left" size={18} color={Colors.brand.primary} />
              <Text style={styles.submitText}>투어 가고 싶어요!</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* 보내기 전 확인: 취소는 아무것도 안 함, 확인은 보내고 투어 홈으로 */}
      <Popup visible={confirming} title="투어 가고 싶어요!" onClose={() => { if (!sending) setConfirming(false); }}>
        <View style={styles.summary}>
          <SummaryRow icon="calendar-outline" text={period} />
          <SummaryRow icon="location-outline" text={place} />
          <SummaryRow icon="people-outline" text={`${draft.headcount}명 (나 포함)`} />
        </View>
        <Text style={styles.confirmText}>
          <Text style={styles.point}>확인</Text>을 누르면 <Text style={styles.point}>강사님들께 알림</Text>이 전송됩니다!
        </Text>
        <View style={styles.warning}>
          <Ionicons name="sad-outline" size={18} color="#FFB4A8" />
          <Text style={styles.warningText}>무분별한 사용은 이용 제한 사유가 될 수 있으니 지양해 주세요.</Text>
        </View>
        <Buttons confirm="확인" busy={sending} onCancel={() => setConfirming(false)} onConfirm={send} />
      </Popup>

      <BottomSheet
        visible={sheet === 'continent'}
        onClose={() => setSheet(null)}
        title="대륙"
        items={continentItems}
        selectedValue={draft.continent}
        fitContent
        onSelect={continent => { if (continent !== draft.continent) set({ continent, country: '' }); }}
      />
      <BottomSheet
        visible={sheet === 'country'}
        onClose={() => setSheet(null)}
        title={`나라 (${regionName(continents, draft.continent)})`}
        items={countryItems}
        selectedValue={draft.country}
        searchable={countryItems.length > 9}
        onSelect={country => set({ country })}
      />
      <DatePickerSheet
        visible={sheet === 'from'}
        onClose={() => setSheet(null)}
        selectedDate={draft.from || today}
        minDate={today}
        onSelect={from => set({ from, to: draft.to && draft.to < from ? from : draft.to })}
      />
      <DatePickerSheet
        visible={sheet === 'to'}
        onClose={() => setSheet(null)}
        selectedDate={draft.to || draft.from || today}
        minDate={draft.from || today}
        onSelect={to => set({ to })}
      />
    </View>
  );
}

function IntroLine({ icon, children }: { icon: React.ComponentProps<typeof Ionicons>['name']; children: React.ReactNode }) {
  return (
    <View style={styles.introLine}>
      <View style={styles.introIcon}><Ionicons name={icon} size={15} color={ACCENT} /></View>
      <Text style={styles.introText}>{children}</Text>
    </View>
  );
}

function StepButton({ icon, label, disabled, onPress }: { icon: 'add' | 'remove'; label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.stepButton, disabled && { opacity: 0.3 }, pressed && { opacity: 0.6 }]}
    >
      <View style={styles.stepCircle}><Ionicons name={icon} size={20} color={Colors.brand.white} /></View>
    </Pressable>
  );
}

function SummaryRow({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) {
  return (
    <View style={styles.summaryRow}>
      <Ionicons name={icon} size={15} color={ACCENT} />
      <Text style={styles.summaryText}>{text}</Text>
    </View>
  );
}

function Selector({ label, placeholder, disabled, icon = 'chevron-down', onPress }: {
  label: string; placeholder?: boolean; disabled?: boolean; icon?: 'chevron-down' | 'calendar-outline'; onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.selector, disabled && { opacity: 0.4 }, pressed && { opacity: 0.7 }]}
    >
      <Text style={[styles.selectorText, placeholder && styles.placeholder]} numberOfLines={1}>{label}</Text>
      <Ionicons name={icon} size={15} color="rgba(255,255,255,0.5)" />
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
  scroll: { paddingHorizontal: SIDE, paddingTop: 8, paddingBottom: 24 },

  intro: {
    borderRadius: 18, padding: 18, gap: 12,
    backgroundColor: 'rgba(0,229,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(0,229,255,0.25)',
  },
  introBadge: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(0,229,255,0.15)',
  },
  introBadgeText: { fontFamily: 'SUIT-Bold', fontSize: 12, color: ACCENT },
  introLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  introIcon: {
    width: 26, height: 26, borderRadius: 13, marginTop: -2,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,229,255,0.12)',
  },
  introText: { flex: 1, fontFamily: 'SUIT-Regular', fontSize: 15, lineHeight: 22, color: 'rgba(255,255,255,0.88)' },
  point: { fontFamily: 'SUIT-Bold', color: ACCENT },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 2 },
  free: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4,
    paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(255,209,102,0.12)',
  },
  freeText: { fontFamily: 'SUIT-SemiBold', fontSize: 15, color: Colors.brand.white },
  freePoint: { fontFamily: 'SUIT-Bold', fontSize: 17, color: FREE },

  label: { fontFamily: 'SUIT-SemiBold', fontSize: 14, color: Colors.brand.white, marginTop: 26, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selector: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 13,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  selectorText: { flex: 1, fontFamily: 'SUIT-Regular', fontSize: 15, color: Colors.brand.white },
  placeholder: { color: 'rgba(255,255,255,0.35)' },
  tilde: { fontFamily: 'SUIT-Regular', fontSize: 15, color: 'rgba(255,255,255,0.5)' },
  headcount: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 4,
  },
  stepButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  stepCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  headcountValue: { fontFamily: 'SUIT-SemiBold', fontSize: 15, color: Colors.brand.white },
  headcountNumber: { fontFamily: 'SUIT-Bold', fontSize: 20, color: ACCENT },
  headcountHint: { fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 6 },
  hint: { fontFamily: 'SUIT-Regular', fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 14 },
  sentNotice: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16,
    padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,209,102,0.12)',
  },
  sentNoticeText: { flex: 1, fontFamily: 'SUIT-SemiBold', fontSize: 13, lineHeight: 19, color: FREE },

  bottomArea: { paddingHorizontal: SIDE, paddingVertical: 12 },
  submitButton: {
    height: 54, borderRadius: 14,
    backgroundColor: Colors.brand.white,
    alignItems: 'center', justifyContent: 'center',
  },
  submitContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  submitText: { fontFamily: 'SUIT-Bold', fontSize: 16, color: Colors.brand.primary },

  summary: { gap: 8, marginTop: 14, padding: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryText: { fontFamily: 'SUIT-SemiBold', fontSize: 15, color: Colors.brand.white },
  confirmText: { fontFamily: 'SUIT-Regular', fontSize: 15, lineHeight: 22, color: 'rgba(255,255,255,0.9)', marginTop: 16 },
  warning: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12,
    padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,107,74,0.12)',
  },
  warningText: { flex: 1, fontFamily: 'SUIT-Regular', fontSize: 13, lineHeight: 19, color: '#FFB4A8' },
});
